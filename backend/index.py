from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import io
import time
from datetime import datetime
import os
import csv
from collections import defaultdict, Counter

app = Flask(__name__)

# Configure CORS - simplified to avoid duplicate headers
CORS(app, origins=['*'], methods=['GET', 'POST', 'OPTIONS'], allow_headers=['Content-Type', 'Authorization', 'Accept'])

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

# Flask-CORS handles OPTIONS requests automatically

@app.route('/upload', methods=['POST'])
def upload_file():
    global processed_transactions, original_data

    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        # Read the CSV file content
        file_content = file.read().decode('utf-8')
        lines = file_content.strip().split('\n')

        if not lines or not lines[0].strip():
            return jsonify({'error': 'Empty file'}), 400

        # Check if this is a simple format (no headers) or structured format (with headers)
        first_line = lines[0].strip()

        # If first line looks like column names, treat as structured CSV
        if ('transaction' in first_line.lower() and 'id' in first_line.lower()) or \
           ('item' in first_line.lower() and ',' in first_line):
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
                    'error': f'Missing required columns. Expected: transaction ID column and items column. Found: {first_row_keys}'
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

    except Exception as e:
        return jsonify({'error': f'Error processing file: {str(e)}'}), 500

@app.route('/mine', methods=['POST'])
def mine_patterns():
    global processed_transactions, algorithms_performance

    try:
        if processed_transactions is None:
            return jsonify({'error': 'No data uploaded. Please upload a file first.'}), 400

        data = request.get_json()
        min_support = data.get('min_support', 0.1)
        algorithm = data.get('algorithm', 'apriori')  # Only apriori supported in this minimal version

        start_time = time.time()

        # Find frequent itemsets
        frequent_itemsets = find_frequent_itemsets(processed_transactions, min_support)

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
        if original_data:
            for row in original_data:
                item_counter[row['Item']] += 1
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

# For local development
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
