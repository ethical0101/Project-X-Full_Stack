from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import io
import time
from datetime import datetime
import os
import csv
from collections import defaultdict, Counter
import sys
import pandas as pd
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from fca import build_concept_lattice, lattice_to_json

app = Flask(__name__)

# Configure CORS for production
cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:3000,http://localhost:3001,https://project-x-full-stack.vercel.app').split(',')
CORS(app, origins=cors_origins, methods=['GET', 'POST', 'OPTIONS'], allow_headers=['Content-Type'])

# Global variables to store processed data
processed_transactions = None
original_data = None
algorithms_performance = {}

def calculate_support(itemset, transactions):
    """Calculate support for an itemset"""
    count = 0
    for transaction in transactions:
        if all(item in transaction for item in itemset):
            count += 1
    return count / len(transactions)

def find_frequent_itemsets(transactions, min_support):
    """Simple Apriori implementation"""
    # Get all unique items
    all_items = set()
    for transaction in transactions:
        all_items.update(transaction)

    frequent_itemsets = []

    # Find frequent 1-itemsets
    for item in all_items:
        support = calculate_support([item], transactions)
        if support >= min_support:
            frequent_itemsets.append({
                'itemset': [item],
                'support': support,
                'length': 1
            })

    # Find frequent 2-itemsets
    frequent_1_items = [fs['itemset'][0] for fs in frequent_itemsets]
    for i, item1 in enumerate(frequent_1_items):
        for item2 in frequent_1_items[i+1:]:
            itemset = [item1, item2]
            support = calculate_support(itemset, transactions)
            if support >= min_support:
                frequent_itemsets.append({
                    'itemset': itemset,
                    'support': support,
                    'length': 2
                })

    return frequent_itemsets

def generate_association_rules(frequent_itemsets, min_confidence=0.5):
    """Generate association rules from frequent itemsets"""
    rules = []

    # Only generate rules from 2-itemsets for simplicity
    for itemset_data in frequent_itemsets:
        if itemset_data['length'] == 2:
            items = itemset_data['itemset']
            support_ab = itemset_data['support']

            # Rule A -> B
            support_a = next((fs['support'] for fs in frequent_itemsets
                            if fs['itemset'] == [items[0]]), 0)
            if support_a > 0:
                confidence = support_ab / support_a
                if confidence >= min_confidence:
                    lift = confidence / next((fs['support'] for fs in frequent_itemsets
                                            if fs['itemset'] == [items[1]]), 1)
                    rules.append({
                        'antecedents': [items[0]],
                        'consequents': [items[1]],
                        'support': support_ab,
                        'confidence': confidence,
                        'lift': lift,
                        'conviction': (1 - next((fs['support'] for fs in frequent_itemsets
                                              if fs['itemset'] == [items[1]]), 1)) / (1 - confidence) if confidence < 1 else None,
                        'zhangs_metric': None
                    })

            # Rule B -> A
            support_b = next((fs['support'] for fs in frequent_itemsets
                            if fs['itemset'] == [items[1]]), 0)
            if support_b > 0:
                confidence = support_ab / support_b
                if confidence >= min_confidence:
                    lift = confidence / support_a
                    rules.append({
                        'antecedents': [items[1]],
                        'consequents': [items[0]],
                        'support': support_ab,
                        'confidence': confidence,
                        'lift': lift,
                        'conviction': (1 - support_a) / (1 - confidence) if confidence < 1 else None,
                        'zhangs_metric': None
                    })

    return rules

@app.route('/')
def home():
    return jsonify({
        "message": "Pattern Mining API",
        "status": "running",
        "endpoints": ["/upload", "/mine", "/analytics"],
        "timestamp": datetime.now().isoformat()
    })

@app.route('/health')
def health():
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})

@app.route('/upload', methods=['POST'])
def upload_file():
    global processed_transactions, original_data

    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        filename = file.filename.lower()

        # File extension detection
        if filename.endswith('.csv'):
            # Process CSV file (existing logic)
            return process_csv_file(file)
        elif filename.endswith('.json'):
            # Process JSON file (existing logic)
            return process_json_file(file)
        elif filename.endswith(('.xlsx', '.xls')):
            # Process Excel file (new logic)
            return process_excel_file(file)
        else:
            return jsonify({'error': 'Unsupported file format. Please upload a CSV, JSON, or Excel file'}), 400

    except Exception as e:
        return jsonify({'error': f'Error processing file: {str(e)}'}), 500

def process_csv_file(file):
    """Process CSV file with structured or simple format detection"""
    global processed_transactions, original_data

    # Read the CSV file content
    file_content = file.read().decode('utf-8')
    lines = file_content.strip().split('\n')

    if not lines or not lines[0].strip():
        return jsonify({'error': 'Empty file'}), 400

    # Check if this is a simple format (no headers) or structured format (with headers)
    first_line = lines[0].strip()

    # If first line looks like proper column headers, treat as structured CSV
    # Must explicitly match expected header patterns
    first_line_lower = first_line.lower()
    has_transaction_id_header = ('transaction' in first_line_lower and 'id' in first_line_lower)
    has_item_header = (first_line_lower.startswith('item') or 'transaction_id,item' in first_line_lower)

    if has_transaction_id_header or has_item_header:
        # Structured CSV format with headers
        csv_reader = csv.DictReader(io.StringIO(file_content))
        data_rows = list(csv_reader)

        if not data_rows:
            return jsonify({'error': 'Empty file'}), 400

        first_row_keys = list(data_rows[0].keys())

        # Find transaction ID column (flexible naming)
        transaction_id_col = None
        items_col = None

        for col in first_row_keys:
            col_lower = col.lower()
            if 'transaction' in col_lower and 'id' in col_lower:
                transaction_id_col = col
            elif col_lower in ['items', 'item', 'products', 'product']:
                items_col = col

        if not transaction_id_col or not items_col:
            return jsonify({
                'error': f'Missing required columns. Expected: ["TransactionID", "Item"] or similar. Found: {first_row_keys}. If this is a simple CSV (items per line), ensure first line doesn\'t start with "item" or contain "TransactionID".'
            }), 400

        # Group by TransactionID and create transaction lists
        transactions_dict = {}
        for row in data_rows:
            transaction_id = row[transaction_id_col]
            items_str = row[items_col]

            # Parse items (handle comma-separated items in quotes)
            if items_str.startswith('"') and items_str.endswith('"'):
                items_str = items_str[1:-1]  # Remove quotes
            items = [item.strip() for item in items_str.split(',')]

            if transaction_id not in transactions_dict:
                transactions_dict[transaction_id] = []
            transactions_dict[transaction_id].extend(items)

        transactions = list(transactions_dict.values())
        original_data = data_rows
    else:
        # Simple CSV format (no headers) - each line is a transaction with items
        transactions = []
        for line_num, line in enumerate(lines, 1):
            if line.strip():  # Skip empty lines
                # Split by comma and clean items
                items = [item.strip().strip('"') for item in line.split(',')]
                items = [item for item in items if item]  # Remove empty items
                if items:  # Only add non-empty transactions
                    transactions.append(items)

        if not transactions:
            return jsonify({'error': 'No valid transactions found'}), 400

        # Create dummy original_data for simple format
        original_data = [{"transaction_id": i, "items": ','.join(transaction)} for i, transaction in enumerate(transactions)]

    processed_transactions = transactions
    return create_upload_response(transactions)

def process_json_file(file):
    """Process JSON file with array of arrays or array of objects format"""
    global processed_transactions, original_data

    file_content = file.read().decode('utf-8')
    data = json.loads(file_content)

    if isinstance(data, list) and len(data) > 0:
        if isinstance(data[0], list):
            # Array of arrays format
            transactions = data
            original_data = [{"transaction_id": i, "items": ','.join(transaction)} for i, transaction in enumerate(transactions)]
        elif isinstance(data[0], dict) and 'items' in data[0]:
            # Array of objects with items field
            transactions = [item['items'] for item in data]
            original_data = data
        else:
            return jsonify({'error': 'Invalid JSON format. Expected array of arrays or array of objects with items field'}), 400
    else:
        return jsonify({'error': 'Invalid JSON format. Expected non-empty array'}), 400

    if not transactions:
        return jsonify({'error': 'No valid transactions found'}), 400

    processed_transactions = transactions
    return create_upload_response(transactions)

def process_excel_file(file):
    """Process Excel file with structured or simple format detection"""
    global processed_transactions, original_data

    try:
        # Determine engine based on file extension
        filename = file.filename.lower()
        if filename.endswith('.xlsx'):
            engine = 'openpyxl'
        else:  # .xls
            engine = 'xlrd'

        # Read Excel file into pandas DataFrame
        df = pd.read_excel(file, engine=engine)

        if df.empty:
            return jsonify({'error': 'Empty Excel file'}), 400

        # Check if this is structured format (with headers) or simple format
        first_row_values = df.iloc[0].astype(str).str.lower()

        # Detect structured format by looking for header patterns
        has_transaction_id_header = any('transaction' in str(val).lower() and 'id' in str(val).lower()
                                      for val in first_row_values)
        has_item_header = any(str(val).lower().startswith('item') or
                            str(val).lower() in ['items', 'product', 'products']
                            for val in first_row_values)

        if has_transaction_id_header or has_item_header:
            # Structured Excel format with headers
            # Use first row as headers
            df.columns = df.iloc[0]
            df = df.drop(0).reset_index(drop=True)

            if df.empty:
                return jsonify({'error': 'Empty Excel file after headers'}), 400

            column_names = list(df.columns)

            # Find transaction ID column (flexible naming)
            transaction_id_col = None
            items_col = None

            for col in column_names:
                col_lower = str(col).lower()
                if 'transaction' in col_lower and 'id' in col_lower:
                    transaction_id_col = col
                elif col_lower in ['items', 'item', 'products', 'product']:
                    items_col = col

            if not transaction_id_col or not items_col:
                return jsonify({
                    'error': f'Missing required columns. Expected: ["TransactionID", "Item"] or similar. Found: {column_names}'
                }), 400

            # Group by TransactionID and create transaction lists
            transactions_dict = {}
            data_rows = []

            for index, row in df.iterrows():
                if pd.isna(row[transaction_id_col]) or pd.isna(row[items_col]):
                    continue  # Skip rows with missing data

                transaction_id = str(row[transaction_id_col])
                items_str = str(row[items_col])

                # Parse items (handle comma-separated items)
                items = [item.strip() for item in items_str.split(',') if item.strip()]

                if transaction_id not in transactions_dict:
                    transactions_dict[transaction_id] = []
                transactions_dict[transaction_id].extend(items)

                # Store row for original_data
                data_rows.append({transaction_id_col: transaction_id, items_col: items_str})

            transactions = list(transactions_dict.values())
            original_data = data_rows
        else:
            # Simple Excel format (no headers) - each row represents a transaction
            transactions = []
            data_rows = []

            for index, row in df.iterrows():
                # Handle different Excel layouts
                non_null_values = [str(val).strip() for val in row if pd.notna(val) and str(val).strip()]

                if non_null_values:
                    # If multiple columns have values, each is an item
                    # If single column, split by comma like simple CSV
                    if len(non_null_values) == 1:
                        # Split single column value by comma
                        items = [item.strip() for item in non_null_values[0].split(',') if item.strip()]
                    else:
                        # Use each non-null column value as an item
                        items = non_null_values

                    if items:  # Only add non-empty transactions
                        transactions.append(items)
                        data_rows.append({"transaction_id": len(transactions)-1, "items": ','.join(items)})

            if not transactions:
                return jsonify({'error': 'No valid transactions found'}), 400

            original_data = data_rows

        processed_transactions = transactions
        return create_upload_response(transactions)

    except Exception as e:
        # Handle specific Excel errors
        if "corrupted" in str(e).lower():
            return jsonify({'error': 'Corrupted Excel file'}), 400
        elif "unsupported format" in str(e).lower():
            return jsonify({'error': 'Invalid Excel file format'}), 400
        else:
            return jsonify({'error': f'Error processing Excel file: {str(e)}'}), 400

def create_upload_response(transactions):
    """Create standardized response for successful uploads"""
    print(f"=== UPLOAD SUCCESS ===")
    print(f"Stored {len(transactions)} transactions")
    print(f"Sample transactions: {transactions[:3]}")

    # Get all unique items
    all_items = set()
    for transaction in transactions:
        all_items.update(transaction)

    # Get basic statistics
    stats = {
        'total_transactions': len(transactions),
        'unique_items': len(all_items),
        'average_items_per_transaction': sum(len(t) for t in transactions) / len(transactions),
        'sample_transactions': transactions[:5] if transactions else []
    }

    return jsonify({
        'message': 'File uploaded and processed successfully',
        'stats': stats,
        'columns': list(all_items)
    })

@app.route('/mine', methods=['POST'])
def mine_patterns():
    global processed_transactions, algorithms_performance

    try:
        print(f"=== MINING REQUEST ===")
        print(f"Processed transactions available: {processed_transactions is not None}")
        if processed_transactions:
            print(f"Number of transactions: {len(processed_transactions)}")
            print(f"Sample transactions: {processed_transactions[:3]}")

        if processed_transactions is None:
            return jsonify({'error': 'No data uploaded. Please upload a file first.'}), 400

        data = request.get_json()
        print(f"Request data: {data}")
        min_support = data.get('min_support', 0.1)
        algorithm = data.get('algorithm', 'apriori')  # Only apriori supported in this minimal version
        print(f"Mining with min_support: {min_support}, algorithm: {algorithm}")

        start_time = time.time()

        # Find frequent itemsets
        frequent_itemsets = find_frequent_itemsets(processed_transactions, min_support)
        print(f"Found {len(frequent_itemsets)} frequent itemsets")

        end_time = time.time()
        execution_time = end_time - start_time

        # Store performance data
        algorithms_performance[algorithm] = {
            'execution_time': execution_time,
            'itemsets_found': len(frequent_itemsets),
            'min_support': min_support,
            'timestamp': datetime.now().isoformat()
        }

        if not frequent_itemsets:
            print(f"NO PATTERNS FOUND with min_support {min_support}")
            return jsonify({
                'frequent_itemsets': [],
                'association_rules': [],
                'performance': algorithms_performance[algorithm],
                'message': 'No frequent itemsets found with the given minimum support'
            })

        # Generate association rules
        rules = generate_association_rules(frequent_itemsets, min_confidence=0.5)

        return jsonify({
            'frequent_itemsets': frequent_itemsets,
            'association_rules': rules,
            'performance': algorithms_performance[algorithm]
        })

    except Exception as e:
        return jsonify({'error': f'Error during mining: {str(e)}'}), 500

@app.route('/analytics', methods=['GET'])
def get_analytics():
    global processed_transactions, algorithms_performance, original_data

    try:
        if processed_transactions is None:
            return jsonify({'error': 'No data available. Please upload and mine data first.'}), 400

        # Re-mine with default parameters for analytics
        min_support = 0.1
        frequent_itemsets = find_frequent_itemsets(processed_transactions, min_support)

        if not frequent_itemsets:
            return jsonify({
                'analytics': {
                    'total_itemsets': 0,
                    'avg_support': 0,
                    'support_distribution': [],
                    'itemset_length_distribution': {},
                    'top_items': [],
                    'performance_comparison': algorithms_performance
                },
                'rules_analysis': {
                    'total_rules': 0,
                    'confidence_distribution': [],
                    'lift_distribution': [],
                    'top_rules': []
                }
            })

        rules = generate_association_rules(frequent_itemsets, min_confidence=0.5)

        # Generate analytics
        support_values = [fs['support'] for fs in frequent_itemsets]
        avg_support = sum(support_values) / len(support_values) if support_values else 0

        # Support distribution
        support_distribution = [
            {'range': '0.0-0.2', 'count': sum(1 for s in support_values if s < 0.2)},
            {'range': '0.2-0.4', 'count': sum(1 for s in support_values if 0.2 <= s < 0.4)},
            {'range': '0.4-0.6', 'count': sum(1 for s in support_values if 0.4 <= s < 0.6)},
            {'range': '0.6-0.8', 'count': sum(1 for s in support_values if 0.6 <= s < 0.8)},
            {'range': '0.8-1.0', 'count': sum(1 for s in support_values if s >= 0.8)}
        ]

        # Length distribution
        length_dist = {}
        for fs in frequent_itemsets:
            length = fs['length']
            length_dist[length] = length_dist.get(length, 0) + 1

        # Top items by frequency
        item_counter = Counter()
        if original_data and len(original_data) > 0:
            # Check if it's the old format with 'Item' column or new format
            if 'Item' in original_data[0]:
                for row in original_data:
                    item_counter[row['Item']] += 1
            else:
                # New format or simple format - count from transactions
                for transaction in processed_transactions:
                    for item in transaction:
                        item_counter[item] += 1
        top_items = [{'item': item, 'frequency': count} for item, count in item_counter.most_common(10)]

        analytics = {
            'total_itemsets': len(frequent_itemsets),
            'avg_support': avg_support,
            'support_distribution': support_distribution,
            'itemset_length_distribution': length_dist,
            'top_items': top_items,
            'performance_comparison': algorithms_performance
        }

        # Rules analysis
        rules_analysis = {
            'total_rules': len(rules),
            'confidence_distribution': [],
            'lift_distribution': [],
            'top_rules': []
        }

        if rules:
            confidence_values = [r['confidence'] for r in rules]
            lift_values = [r['lift'] for r in rules]

            # Confidence distribution
            rules_analysis['confidence_distribution'] = [
                {'range': '0.5-0.6', 'count': sum(1 for c in confidence_values if 0.5 <= c < 0.6)},
                {'range': '0.6-0.7', 'count': sum(1 for c in confidence_values if 0.6 <= c < 0.7)},
                {'range': '0.7-0.8', 'count': sum(1 for c in confidence_values if 0.7 <= c < 0.8)},
                {'range': '0.8-0.9', 'count': sum(1 for c in confidence_values if 0.8 <= c < 0.9)},
                {'range': '0.9-1.0', 'count': sum(1 for c in confidence_values if c >= 0.9)}
            ]

            # Lift distribution
            rules_analysis['lift_distribution'] = [
                {'range': '1.0-1.5', 'count': sum(1 for l in lift_values if 1.0 <= l < 1.5)},
                {'range': '1.5-2.0', 'count': sum(1 for l in lift_values if 1.5 <= l < 2.0)},
                {'range': '2.0-3.0', 'count': sum(1 for l in lift_values if 2.0 <= l < 3.0)},
                {'range': '3.0+', 'count': sum(1 for l in lift_values if l >= 3.0)}
            ]

            # Top rules by lift
            top_rules = sorted(rules, key=lambda x: x['lift'], reverse=True)[:10]
            for rule in top_rules:
                quality = 'Excellent' if rule['lift'] > 2 and rule['confidence'] > 0.8 else \
                         'Good' if rule['lift'] > 1.5 and rule['confidence'] > 0.6 else \
                         'Moderate' if rule['lift'] > 1.2 and rule['confidence'] > 0.5 else 'Weak'
                rule['quality'] = quality

            rules_analysis['top_rules'] = top_rules

        return jsonify({
            'analytics': analytics,
            'rules_analysis': rules_analysis
        })

    except Exception as e:
        return jsonify({'error': f'Error generating analytics: {str(e)}'}), 500

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

        elif filename.endswith('.json'):
            file_content = file.stream.read().decode('utf-8')
            data = json.loads(file_content)

            if isinstance(data, list) and len(data) > 0:
                if isinstance(data[0], list):
                    # Array of arrays format
                    transactions = data
                elif isinstance(data[0], dict) and 'items' in data[0]:
                    # Array of objects with items field
                    transactions = [item['items'] for item in data]
                else:
                    return jsonify({'error': 'Invalid JSON format. Expected array of arrays or array of objects with items field'}), 400
            else:
                return jsonify({'error': 'Invalid JSON format. Expected non-empty array'}), 400

        elif filename.endswith(('.xlsx', '.xls')):
            # Process Excel file for concept lattice
            try:
                # Determine engine based on file extension
                if filename.endswith('.xlsx'):
                    engine = 'openpyxl'
                else:  # .xls
                    engine = 'xlrd'

                # Read Excel file into pandas DataFrame
                df = pd.read_excel(file, engine=engine)

                if df.empty:
                    return jsonify({'error': 'Empty Excel file'}), 400

                # Check if this is structured format (with headers) or simple format
                first_row_values = df.iloc[0].astype(str).str.lower()

                # Detect structured format by looking for header patterns
                has_transaction_id_header = any('transaction' in str(val).lower() and 'id' in str(val).lower()
                                              for val in first_row_values)
                has_item_header = any(str(val).lower().startswith('item') or
                                    str(val).lower() in ['items', 'product', 'products']
                                    for val in first_row_values)

                if has_transaction_id_header or has_item_header:
                    # Structured Excel format with headers
                    # Use first row as headers
                    df.columns = df.iloc[0]
                    df = df.drop(0).reset_index(drop=True)

                    if df.empty:
                        return jsonify({'error': 'Empty Excel file after headers'}), 400

                    column_names = list(df.columns)

                    # Find transaction ID column (flexible naming)
                    transaction_id_col = None
                    items_col = None

                    for col in column_names:
                        col_lower = str(col).lower()
                        if 'transaction' in col_lower and 'id' in col_lower:
                            transaction_id_col = col
                        elif col_lower in ['items', 'item', 'products', 'product']:
                            items_col = col

                    if not transaction_id_col or not items_col:
                        return jsonify({
                            'error': f'Missing required columns. Expected: ["TransactionID", "Item"] or similar. Found: {column_names}'
                        }), 400

                    # Group by TransactionID and create transaction lists
                    transactions_dict = {}

                    for index, row in df.iterrows():
                        if pd.isna(row[transaction_id_col]) or pd.isna(row[items_col]):
                            continue  # Skip rows with missing data

                        transaction_id = str(row[transaction_id_col])
                        items_str = str(row[items_col])

                        # Parse items (handle comma-separated items)
                        items = [item.strip() for item in items_str.split(',') if item.strip()]

                        if transaction_id not in transactions_dict:
                            transactions_dict[transaction_id] = []
                        transactions_dict[transaction_id].extend(items)

                    transactions = list(transactions_dict.values())
                else:
                    # Simple Excel format (no headers) - each row represents a transaction
                    transactions = []

                    for index, row in df.iterrows():
                        # Handle different Excel layouts
                        non_null_values = [str(val).strip() for val in row if pd.notna(val) and str(val).strip()]

                        if non_null_values:
                            # If multiple columns have values, each is an item
                            # If single column, split by comma like simple CSV
                            if len(non_null_values) == 1:
                                # Split single column value by comma
                                items = [item.strip() for item in non_null_values[0].split(',') if item.strip()]
                            else:
                                # Use each non-null column value as an item
                                items = non_null_values

                            if items:  # Only add non-empty transactions
                                transactions.append(items)

            except Exception as e:
                if "corrupted" in str(e).lower():
                    return jsonify({'error': 'Corrupted Excel file'}), 400
                elif "unsupported format" in str(e).lower():
                    return jsonify({'error': 'Invalid Excel file format'}), 400
                else:
                    return jsonify({'error': f'Error processing Excel file: {str(e)}'}), 400
        else:
            return jsonify({'error': 'Unsupported file format. Please upload a CSV, JSON, or Excel file'}), 400

        if not transactions:
            return jsonify({'error': 'No valid transactions found in the file'}), 400

        # Limit transactions for performance (lattice generation can be expensive)
        if len(transactions) > 50:
            transactions = transactions[:50]
            print(f"Limited to first 50 transactions for lattice generation")

        print(f"Processing {len(transactions)} transactions for concept lattice")
        print(f"Sample transactions: {transactions[:3]}")

        # Build concept lattice
        start_time = time.time()
        lattice = build_concept_lattice(transactions)
        end_time = time.time()
        processing_time = end_time - start_time

        print(f"Generated concept lattice with {len(lattice.concepts)} concepts in {processing_time:.2f} seconds")

        # Convert to JSON format
        result = {
            'lattice': lattice_to_json(lattice),
            'processing_time': processing_time,
            'transaction_count': len(transactions),
            'message': f'Successfully generated concept lattice with {len(lattice.concepts)} concepts'
        }

        return jsonify(result)

    except Exception as e:
        print(f"Error in concept lattice generation: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Error generating concept lattice: {str(e)}'}), 500

@app.route('/test-lattice', methods=['POST'])
def test_lattice():
    """Test concept lattice generation with sample data"""
    try:
        # Use simple test transactions
        test_transactions = [
            ['milk', 'bread'],
            ['milk', 'eggs'],
            ['bread', 'butter'],
            ['milk', 'bread', 'butter'],
            ['eggs', 'butter'],
            ['milk', 'eggs', 'butter']
        ]

        print(f"Generating test lattice with {len(test_transactions)} transactions")

        # Build concept lattice
        start_time = time.time()
        lattice = build_concept_lattice(test_transactions)
        end_time = time.time()
        processing_time = end_time - start_time

        result = {
            'lattice': lattice_to_json(lattice),
            'processing_time': processing_time,
            'transaction_count': len(test_transactions),
            'message': f'Test lattice generated with {len(lattice.concepts)} concepts'
        }

        return jsonify(result)

    except Exception as e:
        print(f"Error in test lattice generation: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Error generating test lattice: {str(e)}'}), 500

# Export for Vercel - the app variable is automatically detected

# For local development
if __name__ == '__main__':
    app.run(debug=True)
