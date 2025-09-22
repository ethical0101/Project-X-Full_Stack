from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
from mlxtend.frequent_patterns import apriori, fpgrowth, association_rules
from mlxtend.preprocessing import TransactionEncoder
import json
import io
import time
from datetime import datetime
import numpy as np
import os
from fca import build_concept_lattice, lattice_to_json

app = Flask(__name__)

# Configure CORS for production
cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:3000,http://localhost:3001').split(',')
CORS(app, origins=cors_origins)

# Global variables to store processed data
current_data = None
current_itemsets = None
current_rules = None
current_transactions = None
processing_results = {}

@app.route('/', methods=['GET'])
def root():
    """Root endpoint with API documentation"""
    return jsonify({
        "message": "Frequent Pattern Mining API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/api/health - GET - Health check",
            "upload": "/api/upload - POST - Upload transaction data",
            "mine": "/api/mine - POST - Mine frequent patterns",
            "analytics": "/api/analytics - GET - Get analytics data",
            "results": "/api/results - GET - Get mining results"
        },
        "frontend": "http://localhost:3000",
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})

@app.route('/api/upload', methods=['POST'])
def upload_data():
    """Upload and process transaction data"""
    global current_data, current_itemsets, current_rules, current_transactions, processing_results

    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400

        # Read the uploaded file
        print(f"Processing file: {file.filename}")
        if file.filename and file.filename.endswith('.csv'):
            # Read CSV content as text first to handle variable-length rows
            csv_content = file.stream.read().decode("UTF-8")
            print(f"CSV content preview: {csv_content[:200]}...")

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
                        print(f"Line {line_num}: {items}")

            print(f"Parsed {len(transactions)} transactions from CSV")

            # Create a simple DataFrame for compatibility
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
        else:
            return jsonify({"error": "Unsupported file format. Please upload CSV or JSON"}), 400

        # Store the data
        current_data = df
        current_transactions = transactions  # Store transactions globally

        print(f"Processed {len(transactions)} transactions")
        print(f"Sample transactions: {transactions[:3] if transactions else 'None'}")

        if not transactions:
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

        return jsonify({
            "message": "Data uploaded and processed successfully",
            "stats": stats,
            "item_frequencies": item_frequencies,
            "sample_transactions": transactions[:5]  # First 5 transactions as sample
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/mine', methods=['POST'])
def mine_patterns():
    """Mine frequent patterns and association rules"""
    global current_data, current_itemsets, current_rules, current_transactions, processing_results

    try:
        if current_data is None or current_transactions is None:
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

        # Encode transactions
        te = TransactionEncoder()
        te_ary = te.fit(transactions).transform(transactions)
        # Convert to numpy array
        te_array = np.array(te_ary)
        df_encoded = pd.DataFrame(te_array, columns=te.columns_)

        print(f"Encoded DataFrame shape: {df_encoded.shape}")
        print("Items found:", list(te.columns_))
        print("Support for each item:")
        for col in te.columns_:
            support = df_encoded[col].mean()
            print(f"  {col}: {support:.3f}")

        # Mine frequent itemsets
        start_time = time.time()
        if algorithm == 'apriori':
            frequent_itemsets = apriori(df_encoded, min_support=min_support, use_colnames=True)
        else:  # fpgrowth
            frequent_itemsets = fpgrowth(df_encoded, min_support=min_support, use_colnames=True)

        mining_time = time.time() - start_time

        if frequent_itemsets.empty:
            return jsonify({
                "message": "No frequent itemsets found with the given support threshold",
                "itemsets": [],
                "rules": [],
                "performance": {"mining_time": mining_time}
            })

        print(f"Found {len(frequent_itemsets)} frequent itemsets")
        print("Sample itemsets:", frequent_itemsets.head())

        # Generate association rules (need itemsets with length >= 2)
        frequent_itemsets_filtered = frequent_itemsets[frequent_itemsets['itemsets'].apply(lambda x: len(x) >= 2)]
        print(f"Itemsets with length >= 2: {len(frequent_itemsets_filtered)}")

        if frequent_itemsets_filtered.empty:
            print("No itemsets with length >= 2 found for rule generation")
            rules = pd.DataFrame()  # Empty rules dataframe
        else:
            try:
                # Use the full frequent_itemsets DataFrame for rule generation (not filtered)
                rules = association_rules(frequent_itemsets, metric="confidence", min_threshold=min_confidence)
                print(f"Generated {len(rules)} association rules")
            except Exception as e:
                print(f"Error generating association rules: {e}")
                # Try with support_only=True as fallback
                try:
                    rules = association_rules(frequent_itemsets, metric="confidence", min_threshold=min_confidence, support_only=True)
                    print(f"Generated {len(rules)} association rules with support_only=True")
                except Exception as e2:
                    print(f"Failed with support_only=True too: {e2}")
                    rules = pd.DataFrame()  # Empty rules dataframe        # Convert itemsets to JSON-serializable format
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

        return jsonify({
            "message": "Pattern mining completed successfully",
            "itemsets": itemsets_json,
            "rules": rules_json,
            "performance": performance,
            "quality_metrics": quality_metrics
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/analytics', methods=['GET'])
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

@app.route('/api/results', methods=['GET'])
def get_results():
    """Get the latest mining results"""
    global processing_results

    if not processing_results:
        return jsonify({"error": "No results available. Please run pattern mining first."}), 400

    return jsonify(processing_results)

@app.route('/api/test-upload-and-mine', methods=['POST'])
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

@app.route('/api/test-mining', methods=['GET'])
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

@app.route('/api/debug', methods=['GET'])
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

@app.route('/api/concept-lattice', methods=['POST'])
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

@app.route('/api/test-lattice', methods=['GET'])
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
else:
    # For Vercel deployment
    app.run(debug=False, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
