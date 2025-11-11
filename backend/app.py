from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import pandas as pd
from mlxtend.frequent_patterns import apriori, fpgrowth, association_rules
from collections import Counter
try:
    # eclat may not be available in some mlxtend versions
    from mlxtend.frequent_patterns import eclat
except Exception:
    eclat = None
from mlxtend.preprocessing import TransactionEncoder
import json
import io
import time
from datetime import datetime
import numpy as np
import tempfile
import random
import math
import os
from fca import build_concept_lattice, lattice_to_json

app = Flask(__name__)

# Configure CORS for production
cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:3000,http://localhost:3001,https://project-x-full-stack.vercel.app').split(',')
CORS(app, origins=cors_origins, methods=['GET', 'POST', 'OPTIONS'], allow_headers=['Content-Type'])

# Global variables to store processed data
current_data = None
current_itemsets = None
current_rules = None
current_transactions = None
processing_results = {}

# Processing state for progress tracking
processing_state = {
    "is_processing": False,
    "current_step": "",
    "progress": 0,
    "total_steps": 0,
    "started_at": None,
    "estimated_completion": None
}

@app.route('/', methods=['GET'])
def root():
    """Root endpoint with API documentation"""
    return jsonify({
        "message": "Frequent Pattern Mining API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/health - GET - Health check",
            "upload": "/upload - POST - Upload transaction data",
            "mine": "/mine - POST - Mine frequent patterns",
            "analytics": "/analytics - GET - Get analytics data",
            "results": "/results - GET - Get mining results",
            "generate-dataset": "/generate-dataset - POST - Generate synthetic dataset",
            "download-dataset": "/download-dataset/<filename> - GET - Download generated dataset",
            "status": "/status - GET - Get processing status and progress"
        },
        "frontend": "http://localhost:3000",
        "timestamp": datetime.now().isoformat()
    })

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})

@app.route('/status', methods=['GET'])
def get_status():
    """Get current processing status and progress"""
    global processing_state, current_data, current_itemsets, current_rules

    status_data = {
        "processing": processing_state.copy(),
        "data_status": {
            "has_data": current_data is not None,
            "has_itemsets": current_itemsets is not None,
            "has_rules": current_rules is not None,
            "itemsets_count": len(current_itemsets) if current_itemsets is not None else 0,
            "rules_count": len(current_rules) if current_rules is not None else 0
        },
        "timestamp": datetime.now().isoformat()
    }

    # Add time estimates if processing
    if processing_state["is_processing"] and processing_state["started_at"]:
        elapsed = (datetime.now() - processing_state["started_at"]).total_seconds()
        if processing_state["progress"] > 0:
            total_estimated = elapsed / (processing_state["progress"] / 100)
            remaining = total_estimated - elapsed
            status_data["processing"]["estimated_completion"] = datetime.now().timestamp() + remaining
    return jsonify(status_data)

@app.route('/upload', methods=['POST'])
def upload_data():
    """Upload and process transaction data"""
    global current_data, current_itemsets, current_rules, current_transactions, processing_results

    try:
        # Mark processing state
        processing_state["is_processing"] = True
        processing_state["current_step"] = "upload"
        processing_state["progress"] = 5
        processing_state["started_at"] = datetime.now()

        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400

        # Read the uploaded file
        print(f"Processing file: {file.filename}")
        if file.filename and file.filename.endswith('.csv'):
            # Read CSV content as text first
            csv_content = file.stream.read().decode("UTF-8")
            print(f"CSV content preview: {csv_content[:200]}...")

            transactions = []

            # Try to parse with pandas to detect common formats (item-per-row vs transaction-per-row)
            try:
                # First attempt: assume header present
                df_csv = pd.read_csv(io.StringIO(csv_content), dtype=str, header=0)

                # If dataframe looks like item-per-row (transaction_id + item columns), use grouping
                if 'transaction_id' in df_csv.columns and len(df_csv.columns) >= 2:
                    print("Detected CSV with 'transaction_id' column - treating as item-per-row format")
                    transactions = process_dataframe_to_transactions(df_csv)
                    df = pd.DataFrame({'transaction_id': range(len(transactions))})
                elif df_csv.shape[1] == 2:
                    # Two-column CSV without header: treat as item-per-row
                    print("Detected 2-column CSV - treating as item-per-row format")
                    df_noheader = pd.read_csv(io.StringIO(csv_content), dtype=str, header=None)
                    transactions = process_dataframe_to_transactions(df_noheader)
                    df = pd.DataFrame({'transaction_id': range(len(transactions))})
                else:
                    # Otherwise treat each row as a transaction (comma-separated items)
                    print("Treating CSV as transaction-per-row (one transaction per line)")
                    lines = csv_content.strip().split('\n')
                    for line_num, line in enumerate(lines, 1):
                        if line.strip():  # Skip empty lines
                            items = [item.strip().strip('"') for item in line.split(',')]
                            items = [item for item in items if item]
                            if items:
                                transactions.append(items)
                                print(f"Line {line_num}: {items}")

                    df = pd.DataFrame({'transaction_id': range(len(transactions))})

                print(f"Parsed {len(transactions)} transactions from CSV (pandas-detected path)")

            except Exception as e:
                # Fallback: manual parsing line-by-line
                print(f"CSV parsing with pandas failed ({e}), falling back to simple parsing")
                lines = csv_content.strip().split('\n')
                for line_num, line in enumerate(lines, 1):
                    if line.strip():
                        items = [item.strip().strip('"') for item in line.split(',')]
                        items = [item for item in items if item]
                        if items:
                            transactions.append(items)
                            print(f"Line {line_num}: {items}")

                print(f"Parsed {len(transactions)} transactions from CSV (fallback)")
                df = pd.DataFrame({'transaction_id': range(len(transactions))})

        elif file.filename and file.filename.endswith('.json'):
            data = json.loads(file.stream.read().decode("UTF-8"))
            if isinstance(data, list) and len(data) > 0:
                if isinstance(data[0], list):
                    # Direct transaction format
                    transactions = data
                    df = pd.DataFrame({'transaction_id': range(len(transactions))})
                else:
                    # DataFrame format
                    df = pd.DataFrame(data)
                    transactions = []  # Initialize empty, will handle in fallback
            else:
                return jsonify({"error": "Invalid JSON format"}), 400
        elif file.filename and (file.filename.endswith('.xlsx') or file.filename.endswith('.xls')):
            # Check file size for chunking decision
            file.seek(0, 2)  # Seek to end
            file_size = file.tell()
            file.seek(0)  # Reset to beginning

            # If file is large (>10MB), use chunking
            if file_size > 10 * 1024 * 1024:  # 10MB threshold
                # Use chunking for large Excel files
                transactions = []
                chunk_size = 50000

                # Read Excel file in chunks
                xl = pd.ExcelFile(file)
                sheet_name = xl.sheet_names[0]

                # Read header first
                df_header = pd.read_excel(file, sheet_name=sheet_name, nrows=1)
                skiprows = 1
                chunk_num = 0

                while True:
                    try:
                        df_chunk = pd.read_excel(
                            file,
                            sheet_name=sheet_name,
                            nrows=chunk_size,
                            skiprows=skiprows,
                            header=None
                        )

                        if df_chunk.empty:
                            break

                        # Rename columns to match header
                        columns = {i: col for i, col in enumerate(df_header.columns.tolist())}
                        df_chunk.rename(columns=columns, inplace=True)

                        # Process chunk into transactions
                        chunk_transactions = process_dataframe_to_transactions(df_chunk)
                        transactions.extend(chunk_transactions)

                        skiprows += chunk_size
                        chunk_num += 1

                        print(f"Processed Excel chunk {chunk_num} with {len(chunk_transactions)} transactions")

                    except Exception as e:
                        print(f"Error processing Excel chunk: {e}")
                        break
            else:
                # Small Excel file - read all at once
                df = pd.read_excel(file)
                transactions = process_dataframe_to_transactions(df)

            # Create compatibility DataFrame
            df = pd.DataFrame({'transaction_id': range(len(transactions))})
        else:
            return jsonify({"error": "Unsupported file format. Please upload CSV, JSON, or Excel (.xlsx/.xls) files"}), 400

        # Store the data
        current_data = df
        current_transactions = transactions  # Store transactions globally

        print(f"Processed {len(transactions)} transactions")
        print(f"Sample transactions: {transactions[:3] if transactions else 'None'}")

        if not transactions:
            processing_state["is_processing"] = False
            processing_state["progress"] = 100
            return jsonify({"error": "No valid transactions found in the data"}), 400

        # Encode transactions
        te = TransactionEncoder()
        te_ary = te.fit(transactions).transform(transactions)
        # Convert to numpy array
        te_array = np.array(te_ary)
        df_encoded = pd.DataFrame(te_array, columns=te.columns_)

        # Basic statistics
        stats = {
            "total_transactions": len(transactions),
            "unique_items": len(te.columns_),
            "avg_items_per_transaction": np.mean([len(t) for t in transactions]),
            "min_items": min(len(t) for t in transactions),
            "max_items": max(len(t) for t in transactions)
        }

        # Item frequencies
        item_frequencies = []
        for item in te.columns_:
            support = df_encoded[item].mean()
            item_frequencies.append({
                "item": item,
                "frequency": int(df_encoded[item].sum()),
                "support": float(support)
            })

        # Sort by support
        item_frequencies.sort(key=lambda x: x['support'], reverse=True)

        # Upload processing finished
        processing_state["current_step"] = "upload_complete"
        processing_state["progress"] = 30
        processing_state["is_processing"] = False

        return jsonify({
            "message": "Data uploaded and processed successfully",
            "stats": stats,
            "item_frequencies": item_frequencies,
            "sample_transactions": transactions[:5]  # First 5 transactions as sample
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

def process_dataframe_to_transactions(df):
    """Convert DataFrame to list of transactions"""
    transactions = []

    # Handle different DataFrame formats
    if 'transaction_id' in df.columns:
        # Transaction format: one row per transaction
        item_columns = [col for col in df.columns if col != 'transaction_id']

        # If the DataFrame is an item-per-row (transaction_id, item) format where multiple
        # rows share the same transaction_id, group items by transaction_id into transactions.
        if len(item_columns) == 1 and df.shape[0] > df['transaction_id'].nunique():
            transaction_col = 'transaction_id'
            item_col = item_columns[0]
            grouped = df.groupby(transaction_col)[item_col].apply(list)
            for transaction in grouped:
                clean_transaction = [str(item).strip() for item in transaction if pd.notna(item) and str(item).strip()]
                if clean_transaction:
                    transactions.append(clean_transaction)
        else:
            # Otherwise assume one row per transaction with multiple item columns
            for _, row in df.iterrows():
                transaction = [str(row[col]) for col in item_columns if pd.notna(row[col]) and str(row[col]).strip()]
                if transaction:  # Only add non-empty transactions
                    transactions.append(transaction)
    else:
        # Item format: one row per item
        if len(df.columns) >= 2:
            transaction_col = df.columns[0]
            item_col = df.columns[1]

            # Group by transaction
            grouped = df.groupby(transaction_col)[item_col].apply(list)
            for transaction in grouped:
                clean_transaction = [str(item).strip() for item in transaction if pd.notna(item) and str(item).strip()]
                if clean_transaction:
                    transactions.append(clean_transaction)
        else:
            # Single column format - each row is a transaction
            for _, row in df.iterrows():
                items = str(row.iloc[0]).split(',') if ',' in str(row.iloc[0]) else [str(row.iloc[0])]
                clean_items = [item.strip().strip('"\'') for item in items if item.strip()]
                if clean_items:
                    transactions.append(clean_items)

    return transactions

@app.route('/mine', methods=['POST'])
def mine_patterns():
    """Mine frequent patterns and association rules"""
    global current_data, current_itemsets, current_rules, current_transactions, processing_results

    try:
        # Mark processing state
        processing_state["is_processing"] = True
        processing_state["current_step"] = "mining"
        processing_state["progress"] = 50
        processing_state["started_at"] = datetime.now()

        if current_data is None or current_transactions is None:
            processing_state["is_processing"] = False
            processing_state["progress"] = 100
            return jsonify({"error": "No data uploaded. Please upload data first."}), 400

        # Get parameters
        data = request.get_json()
        min_support = data.get('min_support', 0.01)  # Lower default threshold
        min_confidence = data.get('min_confidence', 0.3)  # Lower default threshold
        algorithm = data.get('algorithm', 'apriori')

        # Use the global transactions
        transactions = current_transactions

        print(f"Processing {len(transactions)} transactions")
        print("Sample transactions:", transactions[:5])
        print("Transaction lengths:", [len(t) for t in transactions[:10]])

        # Prefilter items by frequency to avoid creating extremely large one-hot matrices
        num_transactions = len(transactions)
        item_counts = Counter()
        for t in transactions:
            for it in t:
                item_counts[it] += 1

        unique_items = len(item_counts)
        print(f"Unique items in transactions: {unique_items}")

        # Determine a safe cap for unique items to encode
        MAX_UNIQUE_ITEMS_ENCODE = 15000

        # If too many unique items, keep only the top-K most frequent items
        if unique_items > MAX_UNIQUE_ITEMS_ENCODE:
            most_common = [it for it, _ in item_counts.most_common(MAX_UNIQUE_ITEMS_ENCODE)]
            items_to_keep = set(most_common)
            print(f"Capping unique items to top {MAX_UNIQUE_ITEMS_ENCODE} by frequency to reduce memory usage")
        else:
            items_to_keep = set(item_counts.keys())

        # Filter transactions to keep only items in items_to_keep
        filtered_transactions = [[it for it in t if it in items_to_keep] for t in transactions]

        # If after filtering there are no items, fall back to original transactions (will be handled by adaptive loop)
        if all(len(t) == 0 for t in filtered_transactions):
            df_encoded = pd.DataFrame()
            te = None
            te_columns = []
            print("No items remain after pre-filtering; will rely on adaptive mining to relax thresholds")
        else:
            te = TransactionEncoder()
            te_ary = te.fit(filtered_transactions).transform(filtered_transactions)
            te_array = np.array(te_ary)
            df_encoded = pd.DataFrame(te_array, columns=te.columns_)
            te_columns = list(te.columns_)

            print(f"Encoded DataFrame shape: {df_encoded.shape}")
            print("Items found:", te_columns)
            print("Support for each item (sample):")
            for col in te_columns[:20]:
                support = df_encoded[col].mean()
                print(f"  {col}: {support:.3f}")

        # Mine frequent itemsets with adaptive relaxation if needed
        # Safety floors and parameters
        MIN_SUPPORT_FLOOR = 0.001
        MIN_CONFIDENCE_FLOOR = 0.1
        SUPPORT_RELAX_FACTOR = 0.5  # multiply support by this when relaxing
        CONFIDENCE_RELAX_STEP = 0.05  # subtract this from confidence when relaxing
        MAX_ATTEMPTS = 6

        attempts = []
        current_support = float(min_support)
        current_confidence = float(min_confidence)
        frequent_itemsets = pd.DataFrame()
        rules = pd.DataFrame()
        total_mining_time = 0.0

        for attempt in range(1, MAX_ATTEMPTS + 1):
            attempt_info = {"attempt": attempt, "support": current_support, "confidence": current_confidence}
            start_time = time.time()

            try:
                if algorithm == 'apriori':
                    frequent_itemsets = apriori(df_encoded, min_support=current_support, use_colnames=True)
                elif algorithm == 'eclat' and eclat is not None:
                    frequent_itemsets = eclat(df_encoded, min_support=current_support, use_colnames=True)
                else:
                    # default to fpgrowth when eclat not available or algorithm unspecified
                    frequent_itemsets = fpgrowth(df_encoded, min_support=current_support, use_colnames=True)
            except Exception as e:
                attempt_info['error'] = str(e)
                frequent_itemsets = pd.DataFrame()

            mining_time = time.time() - start_time
            total_mining_time += mining_time
            attempt_info['mining_time'] = mining_time

            # If no itemsets found, relax support and continue
            # Diagnostics
            print(f"Found {len(frequent_itemsets)} frequent itemsets after adaptive attempts")
            print("Attempt summary:")
            try:
                # print attempts if available
                print(attempts)
            except Exception:
                pass

            # Generate association rules (ensure itemsets of length >= 2 exist)
            frequent_itemsets_filtered = frequent_itemsets[frequent_itemsets['itemsets'].apply(lambda x: len(x) >= 2)] if not frequent_itemsets.empty else pd.DataFrame()
            print(f"Itemsets with length >= 2: {len(frequent_itemsets_filtered) if not frequent_itemsets_filtered.empty else 0}")

            if frequent_itemsets_filtered.empty:
                print("No itemsets with length >= 2 found for rule generation")
                rules = pd.DataFrame()  # Empty rules dataframe
                attempts.append(attempt_info)
                # Relax support
                if current_support <= MIN_SUPPORT_FLOOR:
                    break
                current_support = max(MIN_SUPPORT_FLOOR, current_support * SUPPORT_RELAX_FACTOR)
                continue

            # Try to generate rules
            try:
                rules = association_rules(frequent_itemsets, metric="confidence", min_threshold=current_confidence)
            except Exception as e:
                # fallback: try support_only variant
                try:
                    rules = association_rules(frequent_itemsets, metric="confidence", min_threshold=current_confidence, support_only=True)
                except Exception as e2:
                    rules = pd.DataFrame()
                    attempt_info['rule_error'] = str(e2)

            attempt_info['itemsets_found'] = len(frequent_itemsets)
            attempt_info['rules_found'] = len(rules)
            attempts.append(attempt_info)
            # update progress roughly based on attempt
            try:
                processing_state["progress"] = min(90, 50 + int((attempt / MAX_ATTEMPTS) * 40))
            except Exception:
                processing_state["progress"] = 75

            # If rules found, stop; otherwise relax confidence then support
            if not rules.empty:
                break

            # Relax confidence first, then support
            if current_confidence > MIN_CONFIDENCE_FLOOR:
                current_confidence = max(MIN_CONFIDENCE_FLOOR, current_confidence - CONFIDENCE_RELAX_STEP)
            else:
                if current_support <= MIN_SUPPORT_FLOOR:
                    break
                current_support = max(MIN_SUPPORT_FLOOR, current_support * SUPPORT_RELAX_FACTOR)

        # Record total mining time
        mining_time = total_mining_time
        itemsets_json = []
        for _, itemset in frequent_itemsets.iterrows():
            itemsets_json.append({
                "itemset": list(itemset['itemsets']),
                "support": float(itemset['support']),
                "length": len(itemset['itemsets'])
            })

        # Convert rules to JSON-serializable format
        rules_json = []
        if not rules.empty:
            for _, rule in rules.iterrows():
                rules_json.append({
                    "antecedents": list(rule['antecedents']),
                    "consequents": list(rule['consequents']),
                    "support": float(rule['support']),
                    "confidence": float(rule['confidence']),
                    "lift": float(rule['lift']),
                    "conviction": float(rule['conviction']) if not np.isinf(rule['conviction']) else None,
                    "leverage": float(rule['leverage']),
                    "zhang_metric": float(rule['zhangs_metric'])
                })

        print(f"Converted {len(rules_json)} rules to JSON format")

        # Store results
        current_itemsets = frequent_itemsets
        current_rules = rules

        # Calculate performance metrics
        performance = {
            "mining_time": mining_time,
            "algorithm": algorithm,
            "min_support": min_support,
            "min_confidence": min_confidence,
            "itemsets_found": len(frequent_itemsets),
            "rules_found": len(rules)
        }

        # Calculate quality metrics
        if not rules.empty:
            quality_metrics = {
                "avg_confidence": float(rules['confidence'].mean()),
                "avg_lift": float(rules['lift'].mean()),
                "avg_leverage": float(rules['leverage'].mean()),
                "max_confidence": float(rules['confidence'].max()),
                "max_lift": float(rules['lift'].max()),
                "rule_diversity": float(len(set([tuple(r) for r in rules['antecedents']])) / len(rules))
            }
        else:
            quality_metrics = {}

        processing_results = {
            "itemsets": itemsets_json,
            "rules": rules_json,
            "performance": performance,
            "quality_metrics": quality_metrics,
            "timestamp": datetime.now().isoformat()
        }

        # Mark processing finished
        processing_state["is_processing"] = False
        processing_state["current_step"] = "complete"
        processing_state["progress"] = 100

        return jsonify({
            "message": "Pattern mining completed successfully",
            "itemsets": itemsets_json,
            "rules": rules_json,
            "performance": performance,
            "quality_metrics": quality_metrics
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/analytics', methods=['GET'])
def get_analytics():
    """Get advanced analytics and metrics"""
    global processing_results, current_data, current_transactions

    try:
        if not processing_results or current_transactions is None:
            return jsonify({"error": "No data available. Please upload and process data first."}), 400

        # Use the global transactions
        transactions = current_transactions

        # Calculate item frequencies
        te = TransactionEncoder()
        te_ary = te.fit(transactions).transform(transactions)
        # Convert to numpy array
        te_array = np.array(te_ary)
        df_encoded = pd.DataFrame(te_array, columns=te.columns_)

        item_frequencies = []
        for item in te.columns_:
            support = df_encoded[item].mean()
            item_frequencies.append({
                "item": item,
                "frequency": int(df_encoded[item].sum()),
                "support": float(support)
            })

        item_frequencies.sort(key=lambda x: x['support'], reverse=True)

        # Enhanced analytics
        analytics_data = {
            **processing_results,
            "summary": {
                "total_transactions": len(transactions),
                "unique_items": len(te.columns_),
                "avg_items": np.mean([len(t) for t in transactions])
            },
            "item_frequencies": item_frequencies,
            "metrics": {
                **processing_results.get("quality_metrics", {}),
                "rule_coverage": (len(processing_results.get("rules", [])) / max(1, len(te.columns_))) * 100
            }
        }

        return jsonify(analytics_data)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/results', methods=['GET'])
def get_results():
    """Get the latest mining results"""
    global processing_results

    if not processing_results:
        return jsonify({"error": "No results available. Please run pattern mining first."}), 400

    return jsonify(processing_results)

@app.route('/test-upload-and-mine', methods=['POST'])
def test_upload_and_mine():
    """Test the complete upload and mining flow"""
    global current_data, current_itemsets, current_rules, processing_results

    try:
        # Simulate the complete flow with super_patterns.json
        with open('test_data/super_patterns.json', 'r') as f:
            test_data = json.load(f)

        # Store as current_data (simulate upload)
        transactions_list = []
        for item in test_data:
            transactions_list.append(item['items'])

        # Create DataFrame
        current_data = pd.DataFrame({'transactions': transactions_list})

        # Now do the mining part
        transactions = [item['items'] for item in test_data]

        # Encode transactions
        te = TransactionEncoder()
        te_ary = te.fit(transactions).transform(transactions)
        te_array = np.array(te_ary)
        df_encoded = pd.DataFrame(te_array, columns=te.columns_)

        # Mine with the same parameters as frontend
        min_support = 0.1
        min_confidence = 0.3
        frequent_itemsets = apriori(df_encoded, min_support=min_support, use_colnames=True)

        # Generate rules
        rules = association_rules(frequent_itemsets, metric="confidence", min_threshold=min_confidence)

        # Convert to JSON format exactly like the real endpoint
        itemsets_json = []
        for _, itemset in frequent_itemsets.iterrows():
            itemsets_json.append({
                "itemset": list(itemset['itemsets']),
                "support": float(itemset['support']),
                "length": len(itemset['itemsets'])
            })

        rules_json = []
        if not rules.empty:
            for _, rule in rules.iterrows():
                rules_json.append({
                    "antecedents": list(rule['antecedents']),
                    "consequents": list(rule['consequents']),
                    "support": float(rule['support']),
                    "confidence": float(rule['confidence']),
                    "lift": float(rule['lift']),
                    "conviction": float(rule['conviction']) if not np.isinf(rule['conviction']) else None,
                    "leverage": float(rule['leverage']),
                    "zhang_metric": float(rule['zhangs_metric'])
                })

        # Store results
        current_itemsets = frequent_itemsets
        current_rules = rules

        result = {
            "message": "Pattern mining completed successfully",
            "itemsets": itemsets_json,
            "rules": rules_json,
            "performance": {
                "itemsets_found": len(frequent_itemsets),
                "rules_found": len(rules),
                "min_support": min_support,
                "min_confidence": min_confidence
            }
        }

        processing_results = result

        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/test-mining', methods=['GET'])
def test_mining():
    """Test endpoint to verify mining works with super_patterns.json"""
    try:
        # Load super patterns data
        with open('test_data/super_patterns.json', 'r') as f:
            data = json.load(f)

        transactions = [item['items'] for item in data]

        # Encode transactions
        te = TransactionEncoder()
        te_ary = te.fit(transactions).transform(transactions)
        te_array = np.array(te_ary)
        df_encoded = pd.DataFrame(te_array, columns=te.columns_)

        # Mine frequent itemsets
        frequent_itemsets = apriori(df_encoded, min_support=0.1, use_colnames=True)

        # Generate association rules
        rules = association_rules(frequent_itemsets, metric="confidence", min_threshold=0.3)

        return jsonify({
            "success": True,
            "transactions_count": len(transactions),
            "itemsets_count": len(frequent_itemsets),
            "rules_count": len(rules),
            "sample_rules": [
                {
                    "antecedents": list(rules.iloc[i]['antecedents']),
                    "consequents": list(rules.iloc[i]['consequents']),
                    "confidence": float(rules.iloc[i]['confidence']),
                    "support": float(rules.iloc[i]['support']),
                    "lift": float(rules.iloc[i]['lift'])
                } for i in range(min(3, len(rules)))
            ]
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/debug', methods=['GET'])
def debug_data():
    """Debug endpoint to check current data state"""
    global current_data, current_itemsets, current_rules, processing_results

    debug_info = {
        "has_current_data": current_data is not None,
        "data_shape": current_data.shape if current_data is not None else None,
        "data_columns": list(current_data.columns) if current_data is not None else None,
        "has_itemsets": current_itemsets is not None,
        "itemsets_count": len(current_itemsets) if current_itemsets is not None else 0,
        "has_rules": current_rules is not None,
        "rules_count": len(current_rules) if current_rules is not None else 0,
        "has_processing_results": processing_results is not None,
        "sample_data": current_data.head().to_dict() if current_data is not None else None
    }

    return jsonify(debug_info)

@app.route('/generate-dataset', methods=['POST'])
def generate_dataset():
    """Generate synthetic transaction datasets"""
    try:
        # Get parameters from request
        data = request.get_json()

        # Validate required parameters
        required_fields = ['number_of_transactions', 'number_of_items', 'avg_items_per_transaction', 'distribution_type', 'output_format']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required parameter: {field}"}), 400

        number_of_transactions = int(data['number_of_transactions'])
        number_of_items = int(data['number_of_items'])
        avg_items_per_transaction = float(data['avg_items_per_transaction'])
        distribution_type = data['distribution_type'].lower()
        output_format = data['output_format'].lower()

        # Validate parameter ranges
        if number_of_transactions < 1 or number_of_transactions > 1000000:
            return jsonify({"error": "Number of transactions must be between 1 and 1,000,000"}), 400

        if number_of_items < 1 or number_of_items > 10000:
            return jsonify({"error": "Number of items must be between 1 and 10,000"}), 400

        if avg_items_per_transaction < 0.1 or avg_items_per_transaction > number_of_items:
            return jsonify({"error": f"Average items per transaction must be between 0.1 and {number_of_items}"}), 400

        if distribution_type not in ['uniform', 'normal', 'exponential', 'zipf']:
            return jsonify({"error": "Distribution type must be: uniform, normal, exponential, or zipf"}), 400

        if output_format not in ['csv', 'xlsx', 'json']:
            return jsonify({"error": "Output format must be: csv, xlsx, or json"}), 400

        print(f"Generating dataset: {number_of_transactions} transactions, {number_of_items} items, {distribution_type} distribution")

        # Optional minimum items per transaction (ensure each transaction has at least this many items)
        min_items_per_transaction = int(data.get('min_items_per_transaction', 1)) if data.get('min_items_per_transaction') is not None else 1

        # Validate min_items_per_transaction
        if min_items_per_transaction < 1 or min_items_per_transaction > number_of_items:
            return jsonify({"error": f"min_items_per_transaction must be between 1 and {number_of_items}"}), 400

        # Generate synthetic dataset
        start_time = time.time()
        transactions = generate_synthetic_transactions(
            number_of_transactions,
            number_of_items,
            avg_items_per_transaction,
            distribution_type,
            min_items_per_transaction=min_items_per_transaction
        )
        generation_time = time.time() - start_time

        # Optionally embed guaranteed frequent patterns so association rules exist
        # Parameters (optional): guarantee_patterns (int), guarantee_support (float 0-1), pattern_size (int)
        guarantee_patterns = int(data.get('guarantee_patterns', 0)) if data.get('guarantee_patterns') is not None else 0
        guarantee_support = float(data.get('guarantee_support', 0.0)) if data.get('guarantee_support') is not None else 0.0
        pattern_size = int(data.get('pattern_size', 2)) if data.get('pattern_size') is not None else 2

        if guarantee_patterns > 0 and guarantee_support > 0:
            print(f"Embedding {guarantee_patterns} guaranteed patterns of size {pattern_size} with support {guarantee_support}")
            # Build item pool names
            items = [f"Item_{i+1}" for i in range(number_of_items)]
            n_tx = len(transactions)
            for p in range(guarantee_patterns):
                # choose a distinct pattern (avoid duplicates)
                pattern = random.sample(items, k=min(pattern_size, len(items)))
                # choose target transactions to inject the pattern
                k = max(1, int(math.ceil(guarantee_support * n_tx))) if guarantee_support > 0 else 0
                target_idxs = random.sample(range(n_tx), k=min(k, n_tx))
                for idx in target_idxs:
                    # ensure all pattern items are present in the transaction
                    tx = transactions[idx]
                    for it in pattern:
                        if it not in tx:
                            tx.append(it)
                    transactions[idx] = tx

        print(f"Generated {len(transactions)} transactions in {generation_time:.2f} seconds")

        # Create DataFrame for export
        if data.get('export_format') == 'item_per_row':
            # Item-per-row format: transaction_id, item
            rows = []
            for trans_id, items in enumerate(transactions, 1):
                for item in items:
                    rows.append({'transaction_id': trans_id, 'item': item})
            df = pd.DataFrame(rows)
        else:
            # Transaction-per-row format
            max_items = max(len(t) for t in transactions)
            columns = ['transaction_id'] + [f'item_{i+1}' for i in range(max_items)]
            rows = []
            for trans_id, items in enumerate(transactions, 1):
                row = {'transaction_id': trans_id}
                for i in range(max_items):
                    if i < len(items):
                        row[f'item_{i+1}'] = items[i]
                    else:
                        # Use empty string for missing items to avoid type issues when creating DataFrame
                        row[f'item_{i+1}'] = ''
                rows.append(row)
            df = pd.DataFrame(columns=columns, data=rows)

        # Generate file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"synthetic_dataset_{timestamp}.{output_format}"
        # Use system temp dir but fall back to a project-local tmp folder if needed
        temp_dir = tempfile.gettempdir()
        if not os.path.isdir(temp_dir) or not os.access(temp_dir, os.W_OK):
            temp_dir = os.path.join(os.getcwd(), 'tmp')
            os.makedirs(temp_dir, exist_ok=True)
        filepath = os.path.join(temp_dir, filename)

        # Export based on format
        if output_format == 'csv':
            df.to_csv(filepath, index=False)
            mimetype = 'text/csv'
        elif output_format == 'xlsx':
            df.to_excel(filepath, index=False, engine='openpyxl')
            mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        else:  # json
            json_data = {'transactions': transactions}
            with open(filepath, 'w') as f:
                json.dump(json_data, f, indent=2)
            mimetype = 'application/json'

        # Generate preview (first 10 transactions)
        preview_transactions = transactions[:10]

        # Calculate statistics
        item_counts = {}
        for transaction in transactions:
            for item in transaction:
                item_counts[item] = item_counts.get(item, 0) + 1

        item_frequencies = []
        for item, count in sorted(item_counts.items(), key=lambda x: x[1], reverse=True):
            item_frequencies.append({
                "item": item,
                "frequency": count,
                "support": count / len(transactions)
            })

        stats = {
            "total_transactions": len(transactions),
            "unique_items": len(item_counts),
            "avg_items_per_transaction": sum(len(t) for t in transactions) / len(transactions),
            "min_items": min(len(t) for t in transactions),
            "max_items": max(len(t) for t in transactions),
            "generation_time": generation_time,
            "file_size": os.path.getsize(filepath)
        }

        return jsonify({
            "message": "Dataset generated successfully",
            "stats": stats,
            "preview": preview_transactions,
            "download_url": f"/download-dataset/{filename}",
            "item_frequencies": item_frequencies[:20],  # Top 20 items
            "parameters": {
                "number_of_transactions": number_of_transactions,
                "number_of_items": number_of_items,
                "avg_items_per_transaction": avg_items_per_transaction,
                "distribution_type": distribution_type,
                "output_format": output_format
            }
        })

    except Exception as e:
        print(f"Error generating dataset: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to generate dataset: {str(e)}"}), 500

@app.route('/download-dataset/<filename>', methods=['GET'])
def download_dataset(filename):
    """Download generated dataset file"""
    try:
        temp_dir = tempfile.gettempdir()
        if not os.path.isdir(temp_dir) or not os.access(temp_dir, os.W_OK):
            temp_dir = os.path.join(os.getcwd(), 'tmp')
            os.makedirs(temp_dir, exist_ok=True)
        filepath = os.path.join(temp_dir, filename)

        if not os.path.exists(filepath):
            return jsonify({"error": "File not found"}), 404

        # Determine mimetype based on file extension
        if filename.endswith('.csv'):
            mimetype = 'text/csv'
        elif filename.endswith('.xlsx'):
            mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        elif filename.endswith('.json'):
            mimetype = 'application/json'
        else:
            mimetype = 'application/octet-stream'

        return send_file(
            filepath,
            as_attachment=True,
            download_name=filename,
            mimetype=mimetype
        )

    except Exception as e:
        return jsonify({"error": f"Failed to download file: {str(e)}"}), 500

def generate_synthetic_transactions(n_transactions, n_items, avg_items_per_transaction, distribution_type, min_items_per_transaction=1):
    """Generate synthetic transaction data using different distributions"""

    # Create item pool (Item_1, Item_2, ..., Item_n)
    items = [f"Item_{i+1}" for i in range(n_items)]

    transactions = []

    if distribution_type == 'uniform':
        # Uniform distribution - each item has equal probability
        for _ in range(n_transactions):
            # Use Poisson distribution for transaction size around average
            transaction_size = np.random.poisson(avg_items_per_transaction)
            transaction_size = max(min_items_per_transaction, min(transaction_size, n_items))  # Ensure valid size

            # Randomly sample items
            selected_items = np.random.choice(items, size=transaction_size, replace=False)
            transactions.append(list(selected_items))

    elif distribution_type == 'normal':
        # Normal distribution - some items more popular than others
        # Create popularity weights using normal distribution
        popularity_weights = np.random.normal(loc=0, scale=1, size=n_items)
        popularity_weights = np.abs(popularity_weights)  # Make positive
        popularity_weights = popularity_weights / popularity_weights.sum()  # Normalize

        for _ in range(n_transactions):
            transaction_size = np.random.poisson(avg_items_per_transaction)
            transaction_size = max(min_items_per_transaction, min(transaction_size, n_items))

            # Sample items based on popularity weights
            selected_items = np.random.choice(items, size=transaction_size, replace=False, p=popularity_weights)
            transactions.append(list(selected_items))

    elif distribution_type == 'exponential':
        # Exponential distribution - few very popular items, many rare items
        popularity_weights = np.random.exponential(scale=1.0, size=n_items)
        popularity_weights = popularity_weights / popularity_weights.sum()

        for _ in range(n_transactions):
            transaction_size = np.random.poisson(avg_items_per_transaction)
            transaction_size = max(min_items_per_transaction, min(transaction_size, n_items))

            selected_items = np.random.choice(items, size=transaction_size, replace=False, p=popularity_weights)
            transactions.append(list(selected_items))

    elif distribution_type == 'zipf':
        # Zipf distribution - power law distribution (few very popular, long tail)
        # Zipf parameter (s) - higher values mean more skew
        s = 1.2  # Typical Zipf parameter
        ranks = np.arange(1, n_items + 1)
        popularity_weights = 1.0 / (ranks ** s)
        popularity_weights = popularity_weights / popularity_weights.sum()

        for _ in range(n_transactions):
            transaction_size = np.random.poisson(avg_items_per_transaction)
            transaction_size = max(min_items_per_transaction, min(transaction_size, n_items))

            selected_items = np.random.choice(items, size=transaction_size, replace=False, p=popularity_weights)
            transactions.append(list(selected_items))

    return transactions

@app.route('/concept-lattice', methods=['POST'])
def concept_lattice():
    """Generate concept lattice using Formal Concept Analysis"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']
        if file.filename == '' or file.filename is None:
            return jsonify({'error': 'No file selected'}), 400

        filename = file.filename or ''

        # Read the uploaded file
        if filename.endswith('.csv'):
            # Read CSV content as text first to handle variable-length rows
            csv_content = file.stream.read().decode("utf-8")
            print(f"Lattice CSV content preview: {csv_content[:200]}...")

            # Parse CSV manually to handle variable-length transactions
            lines = csv_content.strip().split('\n')
            transactions = []

            for line_num, line in enumerate(lines, 1):
                if line.strip():  # Skip empty lines
                    # Split by comma and clean items
                    items = [item.strip().strip('"') for item in line.split(',')]
                    items = [item for item in items if item]  # Remove empty items
                    if items:  # Only add non-empty transactions
                        transactions.append(items)

            print(f"Lattice: Parsed {len(transactions)} transactions from CSV")

        elif filename.endswith('.json'):
            data = json.loads(file.stream.read().decode("utf-8"))
            if isinstance(data, list) and len(data) > 0:
                if isinstance(data[0], list):
                    transactions = data
                else:
                    # Assume it's list of strings, split by comma
                    transactions = [item.split(',') for item in data]
            else:
                return jsonify({'error': 'Invalid JSON format'}), 400

        else:
            return jsonify({'error': 'Unsupported file format'}), 400

        print(f"Processing {len(transactions)} transactions for concept lattice")

        # Limit to reasonable size for lattice computation
        if len(transactions) > 50:
            print(f"Limiting to first 50 transactions for performance")
            transactions = transactions[:50]

        # Filter out empty transactions
        transactions = [t for t in transactions if t]

        if not transactions:
            return jsonify({'error': 'No valid transactions found'}), 400

        # Build concept lattice
        start_time = time.time()
        lattice = build_concept_lattice(transactions)
        end_time = time.time()

        # Convert to JSON format
        lattice_data = lattice_to_json(lattice)

        print(f"Generated concept lattice with {len(lattice.concepts)} concepts in {end_time - start_time:.2f} seconds")

        return jsonify({
            'lattice': lattice_data,
            'processing_time': end_time - start_time,
            'transaction_count': len(transactions),
            'message': f'Successfully generated concept lattice with {len(lattice.concepts)} concepts'
        })

    except Exception as e:
        print(f"Error in concept lattice generation: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Error generating concept lattice: {str(e)}'}), 500

@app.route('/test-lattice', methods=['GET'])
def test_lattice():
    """Test concept lattice generation with sample data"""
    try:
        # Use simple test transactions
        test_transactions = [
            ['milk', 'bread'],
            ['milk', 'bread', 'butter'],
            ['milk', 'butter'],
            ['bread', 'butter'],
            ['milk'],
            ['bread'],
            ['butter']
        ]

        print(f"Testing lattice with {len(test_transactions)} transactions")

        # Build concept lattice
        start_time = time.time()
        lattice = build_concept_lattice(test_transactions)
        end_time = time.time()

        # Convert to JSON format
        lattice_data = lattice_to_json(lattice)

        return jsonify({
            'lattice': lattice_data,
            'processing_time': end_time - start_time,
            'transaction_count': len(test_transactions),
            'test_data': test_transactions,
            'message': f'Test lattice generated with {len(lattice.concepts)} concepts'
        })

    except Exception as e:
        print(f"Error in test lattice: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Error in test lattice: {str(e)}'}), 500

if __name__ == '__main__':
    # For local development
    app.run(debug=True, host='0.0.0.0', port=5000)

# For Vercel deployment - this makes the app available to Vercel
# The app variable is automatically imported by Vercel
