from flask import Flask, request, jsonify
from flask_cors import CORS
import csv
import io
import json
import os
import time
from collections import Counter
from datetime import datetime
from typing import List, Tuple

from fca import build_concept_lattice, lattice_to_json

app = Flask(__name__)

# Configure CORS for production
cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:3000,http://localhost:3001,https://project-x-full-stack.vercel.app').split(',')
CORS(app, origins=cors_origins, methods=['GET', 'POST', 'OPTIONS'], allow_headers=['Content-Type'])

# Global variables to store processed data and status
processed_transactions: List[List[str]] | None = None
original_data = None
algorithms_performance: dict = {}
latest_results = {"itemsets": [], "rules": []}
latest_quality_metrics = {}

processing_state = {
    "is_processing": False,
    "current_step": "Idle",
    "progress": 0,
    "total_steps": 3,
    "started_at": None,
    "estimated_completion": None
}


def now_iso() -> str:
    return datetime.now().isoformat()


def update_processing_state(**kwargs) -> None:
    processing_state.update(kwargs)


def read_uploaded_text(file_storage) -> str:
    file_storage.stream.seek(0)
    content = file_storage.read()
    file_storage.stream.seek(0)
    if isinstance(content, bytes):
        return content.decode('utf-8', errors='ignore')
    return str(content)


def parse_simple_csv(text: str) -> List[List[str]]:
    transactions = []
    for line in text.strip().splitlines():
        if not line.strip():
            continue
        items = [item.strip().strip('"').strip("'") for item in line.split(',') if item.strip()]
        if items:
            transactions.append(items)
    return transactions


def parse_structured_csv(text: str) -> Tuple[List[List[str]], List[str]]:
    reader = csv.DictReader(io.StringIO(text))
    fieldnames = list(reader.fieldnames or [])
    rows = list(reader)

    if not rows:
        return parse_simple_csv(text), fieldnames

    transaction_col = next((col for col in fieldnames if 'transaction' in col.lower() and 'id' in col.lower()), None)
    single_item_col = None
    if transaction_col:
        single_item_col = next((col for col in fieldnames if col != transaction_col and col.lower() in {'item', 'items', 'product', 'products'}), None)

    transactions: List[List[str]] = []

    if transaction_col and single_item_col:
        grouped: dict[str, List[str]] = {}
        for row in rows:
            transaction_id = (row.get(transaction_col) or '').strip()
            item_value = (row.get(single_item_col) or '').strip()
            if not transaction_id or not item_value:
                continue
            grouped.setdefault(transaction_id, []).append(item_value)
        transactions = list(grouped.values())
    elif transaction_col:
        item_columns = [col for col in fieldnames if col != transaction_col]
        for row in rows:
            items = [(row.get(col) or '').strip() for col in item_columns if (row.get(col) or '').strip()]
            if items:
                transactions.append(items)
    else:
        transactions = parse_simple_csv(text)

    return transactions, fieldnames


def parse_json_transactions(text: str) -> List[List[str]]:
    data = json.loads(text)
    transactions: List[List[str]] = []

    if isinstance(data, dict):
        if isinstance(data.get('transactions'), list):
            transactions = [
                [str(item).strip() for item in transaction if str(item).strip()]
                for transaction in data['transactions']
                if isinstance(transaction, list)
            ]
        elif isinstance(data.get('data'), list):
            return parse_json_transactions(json.dumps(data['data']))
    elif isinstance(data, list):
        if not data:
            return []
        if isinstance(data[0], list):
            transactions = [
                [str(item).strip() for item in transaction if str(item).strip()]
                for transaction in data
            ]
        elif isinstance(data[0], dict):
            transaction_key = next((key for key in data[0].keys() if 'transaction' in key.lower()), None)
            item_key = next((key for key in data[0].keys() if key != transaction_key and key.lower() in {'item', 'items', 'product', 'products'}), None)
            if transaction_key and item_key:
                grouped: dict[str, List[str]] = {}
                for row in data:
                    transaction_id = str(row.get(transaction_key, '')).strip()
                    item_value = str(row.get(item_key, '')).strip()
                    if not transaction_id or not item_value:
                        continue
                    grouped.setdefault(transaction_id, []).append(item_value)
                transactions = list(grouped.values())

    return transactions


def extract_transactions(file_storage) -> Tuple[List[List[str]], List[str]]:
    filename = (file_storage.filename or '').lower()
    text = read_uploaded_text(file_storage)

    if filename.endswith('.json'):
        transactions = parse_json_transactions(text)
        header_columns: List[str] = []
    else:
        transactions, header_columns = parse_structured_csv(text)

    clean_transactions = [
        [item for item in (entry.strip() for entry in transaction) if item]
        for transaction in transactions
        if transaction
    ]

    return clean_transactions, header_columns


def calculate_support(itemset, transactions):
    count = 0
    for transaction in transactions:
        if all(item in transaction for item in itemset):
            count += 1
    return count / len(transactions)


def find_frequent_itemsets(transactions, min_support):
    all_items = set()
    for transaction in transactions:
        all_items.update(transaction)

    frequent_itemsets = []

    for item in all_items:
        support = calculate_support([item], transactions)
        if support >= min_support:
            frequent_itemsets.append({'itemset': [item], 'support': support, 'length': 1})

    frequent_1_items = [fs['itemset'][0] for fs in frequent_itemsets]
    for i, item1 in enumerate(frequent_1_items):
        for item2 in frequent_1_items[i + 1:]:
            itemset = [item1, item2]
            support = calculate_support(itemset, transactions)
            if support >= min_support:
                frequent_itemsets.append({'itemset': itemset, 'support': support, 'length': 2})

    return frequent_itemsets


def generate_association_rules(frequent_itemsets, min_confidence=0.5):
    rules = []

    for itemset_data in frequent_itemsets:
        if itemset_data['length'] != 2:
            continue
        items = itemset_data['itemset']
        support_ab = itemset_data['support']

        support_a = next((fs['support'] for fs in frequent_itemsets if fs['itemset'] == [items[0]]), 0)
        support_b = next((fs['support'] for fs in frequent_itemsets if fs['itemset'] == [items[1]]), 0)

        if support_a > 0:
            confidence_ab = support_ab / support_a
            if confidence_ab >= min_confidence:
                lift_ab = confidence_ab / support_b if support_b else confidence_ab
                rules.append({
                    'antecedents': [items[0]],
                    'consequents': [items[1]],
                    'support': support_ab,
                    'confidence': confidence_ab,
                    'lift': lift_ab,
                    'conviction': (1 - support_b) / (1 - confidence_ab) if confidence_ab < 1 else None,
                    'zhangs_metric': None
                })

        if support_b > 0:
            confidence_ba = support_ab / support_b
            if confidence_ba >= min_confidence:
                lift_ba = confidence_ba / support_a if support_a else confidence_ba
                rules.append({
                    'antecedents': [items[1]],
                    'consequents': [items[0]],
                    'support': support_ab,
                    'confidence': confidence_ba,
                    'lift': lift_ba,
                    'conviction': (1 - support_a) / (1 - confidence_ba) if confidence_ba < 1 else None,
                    'zhangs_metric': None
                })

    return rules


def calculate_item_frequencies(transactions: List[List[str]]):
    counter = Counter()
    for transaction in transactions:
        for item in transaction:
            counter[item] += 1

    total_transactions = len(transactions) or 1
    return [
        {
            'item': item,
            'frequency': count,
            'support': count / total_transactions
        }
        for item, count in counter.most_common()
    ]


def build_quality_metrics(rules: List[dict], transactions: List[List[str]]):
    if not rules:
        return {}

    confidences = [rule['confidence'] for rule in rules]
    lifts = [rule['lift'] for rule in rules]
    supports = [rule['support'] for rule in rules]
    unique_antecedents = {
        tuple(rule['antecedents']) for rule in rules if rule.get('antecedents')
    }

    total_transactions = len(transactions) or 1

    return {
        'avg_confidence': sum(confidences) / len(confidences) if confidences else 0,
        'avg_lift': sum(lifts) / len(lifts) if lifts else 0,
        'avg_support': sum(supports) / len(supports) if supports else 0,
        'max_confidence': max(confidences) if confidences else 0,
        'max_lift': max(lifts) if lifts else 0,
        'rule_diversity': len(unique_antecedents) / len(rules) if rules else 0,
        'rule_coverage': (len(rules) / total_transactions) * 100
    }


@app.route('/')
def home():
    return jsonify({
        "message": "Pattern Mining API",
        "status": "running",
        "endpoints": [
            "/upload", "/mine", "/analytics", "/status", "/concept-lattice", "/test-lattice"
        ],
        "timestamp": now_iso()
    })


@app.route('/health')
def health():
    return jsonify({"status": "healthy", "timestamp": now_iso()})


@app.route('/status', methods=['GET'])
def status():
    data_status = {
        'has_data': processed_transactions is not None,
        'has_itemsets': bool(latest_results.get('itemsets')),
        'has_rules': bool(latest_results.get('rules')),
        'itemsets_count': len(latest_results.get('itemsets') or []),
        'rules_count': len(latest_results.get('rules') or [])
    }

    return jsonify({
        'processing': dict(processing_state),
        'data_status': data_status,
        'timestamp': now_iso()
    })


@app.route('/upload', methods=['POST'])
def upload_file():
    global processed_transactions, original_data, latest_results

    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400

        file = request.files['file']
        if not file.filename:
            return jsonify({'error': 'No file selected'}), 400

        update_processing_state(
            is_processing=True,
            current_step='Processing uploaded data',
            progress=20,
            started_at=now_iso(),
            estimated_completion=None
        )

        transactions, header_columns = extract_transactions(file)

        if not transactions:
            update_processing_state(is_processing=False, current_step='Awaiting new upload', progress=0)
            return jsonify({
                'error': "No valid transactions found in the uploaded file.",
                'columns': header_columns
            }), 400

        processed_transactions = transactions
        original_data = {'header_columns': header_columns, 'sample': transactions[:5]}
        latest_results = {"itemsets": [], "rules": []}

        all_items = sorted({item for transaction in transactions for item in transaction})
        avg_items = sum(len(t) for t in transactions) / len(transactions)

        stats = {
            'total_transactions': len(transactions),
            'unique_items': len(all_items),
            'average_items_per_transaction': avg_items,
            'avg_items_per_transaction': avg_items,
            'sample_transactions': transactions[:5]
        }

        update_processing_state(
            is_processing=False,
            current_step='Data ready for mining',
            progress=33,
            estimated_completion=None
        )

        return jsonify({
            'message': 'File uploaded and processed successfully',
            'stats': stats,
            'columns': all_items,
            'item_frequencies': calculate_item_frequencies(transactions)
        })

    except Exception as exc:
        update_processing_state(is_processing=False, current_step='Upload failed', progress=0)
        return jsonify({'error': f'Error processing file: {str(exc)}'}), 500


@app.route('/mine', methods=['POST'])
def mine_patterns():
    global processed_transactions, algorithms_performance, latest_results, latest_quality_metrics

    if processed_transactions is None:
        return jsonify({'error': 'No data uploaded. Please upload a file first.'}), 400

    try:
        data = request.get_json() or {}
        min_support = data.get('min_support', 0.1)
        min_confidence = data.get('min_confidence', 0.5)
        algorithm = data.get('algorithm', 'apriori')

        update_processing_state(
            is_processing=True,
            current_step=f'Mining patterns ({algorithm})',
            progress=66,
            started_at=now_iso(),
            estimated_completion=None
        )

        start_time = time.time()
        frequent_itemsets = find_frequent_itemsets(processed_transactions, min_support)
        execution_time = time.time() - start_time

        algorithms_performance[algorithm] = {
            'execution_time': execution_time,
            'min_support': min_support,
            'min_confidence': min_confidence,
            'itemsets_found': len(frequent_itemsets),
            'timestamp': now_iso(),
            'algorithm': algorithm
        }

        if not frequent_itemsets:
            update_processing_state(is_processing=False, current_step='Mining complete', progress=100)
            latest_results = {"itemsets": [], "rules": []}
            latest_quality_metrics = {}
            return jsonify({
                'frequent_itemsets': [],
                'association_rules': [],
                'performance': algorithms_performance[algorithm],
                'message': 'No frequent itemsets found with the given minimum support'
            })

        rules = generate_association_rules(frequent_itemsets, min_confidence=min_confidence)
        quality_metrics = build_quality_metrics(rules, processed_transactions)

        latest_results = {"itemsets": frequent_itemsets, "rules": rules}
        latest_quality_metrics = quality_metrics

        update_processing_state(is_processing=False, current_step='Mining complete', progress=100)

        return jsonify({
            'frequent_itemsets': frequent_itemsets,
            'association_rules': rules,
            'performance': algorithms_performance[algorithm],
            'quality_metrics': quality_metrics
        })

    except Exception as exc:
        update_processing_state(is_processing=False, current_step='Mining failed', progress=0)
        return jsonify({'error': f'Error during mining: {str(exc)}'}), 500


@app.route('/analytics', methods=['GET'])
def get_analytics():
    global processed_transactions, algorithms_performance, latest_results, latest_quality_metrics

    if processed_transactions is None:
        return jsonify({'error': 'No data available. Please upload and mine data first.'}), 400

    try:
        transactions = processed_transactions
        itemsets = latest_results.get('itemsets')
        rules = latest_results.get('rules')

        if not itemsets:
            itemsets = find_frequent_itemsets(transactions, 0.1)

        if not rules:
            rules = generate_association_rules(itemsets, min_confidence=0.5)

        support_values = [fs['support'] for fs in itemsets]
        avg_support = sum(support_values) / len(support_values) if support_values else 0

        support_distribution = [
            {'range': '0.0-0.2', 'count': sum(1 for s in support_values if s < 0.2)},
            {'range': '0.2-0.4', 'count': sum(1 for s in support_values if 0.2 <= s < 0.4)},
            {'range': '0.4-0.6', 'count': sum(1 for s in support_values if 0.4 <= s < 0.6)},
            {'range': '0.6-0.8', 'count': sum(1 for s in support_values if 0.6 <= s < 0.8)},
            {'range': '0.8-1.0', 'count': sum(1 for s in support_values if s >= 0.8)}
        ]

        length_distribution = {}
        for fs in itemsets:
            length = fs['length']
            length_distribution[length] = length_distribution.get(length, 0) + 1

        item_frequencies = calculate_item_frequencies(transactions)

        analytics_payload = {
            'total_itemsets': len(itemsets),
            'avg_support': avg_support,
            'support_distribution': support_distribution,
            'itemset_length_distribution': length_distribution,
            'top_items': item_frequencies[:10],
            'item_frequencies': item_frequencies,
            'performance_comparison': algorithms_performance,
            'total_transactions': len(transactions),
            'unique_items': len({item for transaction in transactions for item in transaction}),
            'avg_items': sum(len(t) for t in transactions) / len(transactions) if transactions else 0
        }

        rules_analysis = {
            'total_rules': len(rules),
            'confidence_distribution': [],
            'lift_distribution': [],
            'top_rules': []
        }

        if rules:
            confidence_values = [rule['confidence'] for rule in rules]
            lift_values = [rule['lift'] for rule in rules]

            rules_analysis['confidence_distribution'] = [
                {'range': '0.5-0.6', 'count': sum(1 for c in confidence_values if 0.5 <= c < 0.6)},
                {'range': '0.6-0.7', 'count': sum(1 for c in confidence_values if 0.6 <= c < 0.7)},
                {'range': '0.7-0.8', 'count': sum(1 for c in confidence_values if 0.7 <= c < 0.8)},
                {'range': '0.8-0.9', 'count': sum(1 for c in confidence_values if 0.8 <= c < 0.9)},
                {'range': '0.9-1.0', 'count': sum(1 for c in confidence_values if c >= 0.9)}
            ]

            rules_analysis['lift_distribution'] = [
                {'range': '1.0-1.5', 'count': sum(1 for l in lift_values if 1.0 <= l < 1.5)},
                {'range': '1.5-2.0', 'count': sum(1 for l in lift_values if 1.5 <= l < 2.0)},
                {'range': '2.0-3.0', 'count': sum(1 for l in lift_values if 2.0 <= l < 3.0)},
                {'range': '3.0+', 'count': sum(1 for l in lift_values if l >= 3.0)}
            ]

            top_rules = sorted(rules, key=lambda x: x['lift'], reverse=True)[:10]
            for rule in top_rules:
                lift_value = rule['lift']
                confidence_value = rule['confidence']
                if lift_value > 2 and confidence_value > 0.8:
                    quality = 'Excellent'
                elif lift_value > 1.5 and confidence_value > 0.6:
                    quality = 'Good'
                elif lift_value > 1.2 and confidence_value > 0.5:
                    quality = 'Moderate'
                else:
                    quality = 'Weak'
                rule['quality'] = quality
            rules_analysis['top_rules'] = top_rules

        quality_metrics = latest_quality_metrics or build_quality_metrics(rules, transactions)

        return jsonify({
            'analytics': analytics_payload,
            'rules_analysis': rules_analysis,
            'quality_metrics': quality_metrics
        })

    except Exception as exc:
        return jsonify({'error': f'Error generating analytics: {str(exc)}'}), 500


@app.route('/concept-lattice', methods=['POST'])
def concept_lattice():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']
        if not file.filename:
            return jsonify({'error': 'No file selected'}), 400

        transactions, _ = extract_transactions(file)

        if not transactions:
            return jsonify({'error': 'No valid transactions found for concept lattice generation.'}), 400

        start_time = time.time()
        lattice = build_concept_lattice(transactions)
        processing_time = time.time() - start_time
        lattice_json = lattice_to_json(lattice)

        return jsonify({
            'message': 'Concept lattice generated successfully',
            'lattice': lattice_json,
            'processing_time': processing_time,
            'transaction_count': len(transactions)
        })

    except Exception as exc:
        return jsonify({'error': f'Error generating concept lattice: {str(exc)}'}), 500


@app.route('/test-lattice', methods=['POST'])
def test_lattice():
    sample_transactions = [
        ['bread', 'milk'],
        ['bread', 'diapers', 'beer', 'eggs'],
        ['milk', 'diapers', 'beer', 'cola'],
        ['bread', 'milk', 'diapers', 'beer'],
        ['bread', 'milk', 'diapers', 'cola']
    ]

    start_time = time.time()
    lattice = build_concept_lattice(sample_transactions)
    processing_time = time.time() - start_time

    return jsonify({
        'message': 'Sample concept lattice generated successfully',
        'lattice': lattice_to_json(lattice),
        'processing_time': processing_time,
        'transaction_count': len(sample_transactions)
    })


# Export for Vercel - the app variable is automatically detected

# For local development
if __name__ == '__main__':
    app.run(debug=True)
