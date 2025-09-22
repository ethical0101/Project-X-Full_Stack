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
cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:3000,http://localhost:3001,https://project-x-full-stack.vercel.app').split(',')
CORS(app, origins=cors_origins, methods=['GET', 'POST', 'OPTIONS'], allow_headers=['Content-Type'])

# Global variables to store processed data
processed_transactions = None
original_data = None
algorithms_performance = {}

@app.route('/')
def home():
    return jsonify({
        "message": "Pattern Mining API",
        "status": "running",
        "endpoints": ["/upload", "/mine", "/analytics", "/concept-lattice"],
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

        # Read the CSV file
        df = pd.read_csv(io.StringIO(file.read().decode('utf-8')))

        # Store original data
        original_data = df.copy()

        # Validate required columns
        required_columns = ['TransactionID', 'Item']
        if not all(col in df.columns for col in required_columns):
            return jsonify({
                'error': f'Missing required columns. Expected: {required_columns}, Found: {list(df.columns)}'
            }), 400

        # Group by TransactionID and create transaction lists
        transactions = df.groupby('TransactionID')['Item'].apply(list).tolist()

        # Use TransactionEncoder to create binary matrix
        te = TransactionEncoder()
        te_ary = te.fit_transform(transactions)
        # Ensure we have a numpy array
        try:
            if hasattr(te_ary, 'toarray'):
                te_ary = te_ary.toarray()
        except:
            pass
        processed_df = pd.DataFrame(te_ary, columns=te.columns_)

        # Store processed transactions globally
        processed_transactions = processed_df

        # Get basic statistics
        stats = {
            'total_transactions': len(transactions),
            'unique_items': len(te.columns_),
            'average_items_per_transaction': np.mean([len(t) for t in transactions]),
            'sample_transactions': transactions[:5] if transactions else []
        }

        return jsonify({
            'message': 'File uploaded and processed successfully',
            'stats': stats,
            'columns': list(te.columns_)
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
        algorithm = data.get('algorithm', 'apriori')

        start_time = time.time()

        if algorithm == 'apriori':
            frequent_itemsets = apriori(processed_transactions, min_support=min_support, use_colnames=True)
        elif algorithm == 'fpgrowth':
            frequent_itemsets = fpgrowth(processed_transactions, min_support=min_support, use_colnames=True)
        else:
            return jsonify({'error': 'Invalid algorithm. Use "apriori" or "fpgrowth"'}), 400

        end_time = time.time()
        execution_time = end_time - start_time

        # Store performance data
        algorithms_performance[algorithm] = {
            'execution_time': execution_time,
            'itemsets_found': len(frequent_itemsets),
            'min_support': min_support,
            'timestamp': datetime.now().isoformat()
        }

        if frequent_itemsets.empty:
            return jsonify({
                'frequent_itemsets': [],
                'association_rules': [],
                'performance': algorithms_performance[algorithm],
                'message': 'No frequent itemsets found with the given minimum support'
            })

        # Generate association rules
        rules = association_rules(frequent_itemsets, metric="confidence", min_threshold=0.5)

        # Convert to JSON-serializable format
        itemsets_json = []
        for _, row in frequent_itemsets.iterrows():
            itemsets_json.append({
                'itemset': list(row['itemsets']),
                'support': float(row['support']),
                'length': len(row['itemsets'])
            })

        rules_json = []
        if not rules.empty:
            for _, row in rules.iterrows():
                rules_json.append({
                    'antecedents': list(row['antecedents']),
                    'consequents': list(row['consequents']),
                    'support': float(row['support']),
                    'confidence': float(row['confidence']),
                    'lift': float(row['lift']),
                    'conviction': float(row['conviction']) if not np.isinf(row['conviction']) else None,
                    'zhangs_metric': float(row['zhangs_metric']) if 'zhangs_metric' in row else None
                })

        return jsonify({
            'frequent_itemsets': itemsets_json,
            'association_rules': rules_json,
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
        frequent_itemsets = apriori(processed_transactions, min_support=min_support, use_colnames=True)

        if frequent_itemsets.empty:
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

        rules = association_rules(frequent_itemsets, metric="confidence", min_threshold=0.5)

        # Generate analytics
        analytics = {
            'total_itemsets': len(frequent_itemsets),
            'avg_support': float(frequent_itemsets['support'].mean()),
            'support_distribution': [
                {'range': '0.0-0.2', 'count': len(frequent_itemsets[frequent_itemsets['support'] < 0.2])},
                {'range': '0.2-0.4', 'count': len(frequent_itemsets[(frequent_itemsets['support'] >= 0.2) & (frequent_itemsets['support'] < 0.4)])},
                {'range': '0.4-0.6', 'count': len(frequent_itemsets[(frequent_itemsets['support'] >= 0.4) & (frequent_itemsets['support'] < 0.6)])},
                {'range': '0.6-0.8', 'count': len(frequent_itemsets[(frequent_itemsets['support'] >= 0.6) & (frequent_itemsets['support'] < 0.8)])},
                {'range': '0.8-1.0', 'count': len(frequent_itemsets[frequent_itemsets['support'] >= 0.8])}
            ],
            'itemset_length_distribution': frequent_itemsets.groupby(frequent_itemsets['itemsets'].apply(len)).size().to_dict(),
            'top_items': [],
            'performance_comparison': algorithms_performance
        }

        # Calculate top items by frequency
        if original_data is not None:
            item_counts = original_data['Item'].value_counts().head(10)
            analytics['top_items'] = [{'item': item, 'frequency': int(count)} for item, count in item_counts.items()]

        # Rules analysis
        rules_analysis = {
            'total_rules': len(rules),
            'confidence_distribution': [],
            'lift_distribution': [],
            'top_rules': []
        }

        if not rules.empty:
            # Confidence distribution
            rules_analysis['confidence_distribution'] = [
                {'range': '0.5-0.6', 'count': len(rules[(rules['confidence'] >= 0.5) & (rules['confidence'] < 0.6)])},
                {'range': '0.6-0.7', 'count': len(rules[(rules['confidence'] >= 0.6) & (rules['confidence'] < 0.7)])},
                {'range': '0.7-0.8', 'count': len(rules[(rules['confidence'] >= 0.7) & (rules['confidence'] < 0.8)])},
                {'range': '0.8-0.9', 'count': len(rules[(rules['confidence'] >= 0.8) & (rules['confidence'] < 0.9)])},
                {'range': '0.9-1.0', 'count': len(rules[rules['confidence'] >= 0.9])}
            ]

            # Lift distribution
            rules_analysis['lift_distribution'] = [
                {'range': '1.0-1.5', 'count': len(rules[(rules['lift'] >= 1.0) & (rules['lift'] < 1.5)])},
                {'range': '1.5-2.0', 'count': len(rules[(rules['lift'] >= 1.5) & (rules['lift'] < 2.0)])},
                {'range': '2.0-3.0', 'count': len(rules[(rules['lift'] >= 2.0) & (rules['lift'] < 3.0)])},
                {'range': '3.0+', 'count': len(rules[rules['lift'] >= 3.0])}
            ]

            # Top rules by lift
            top_rules = rules.nlargest(10, 'lift')
            rules_analysis['top_rules'] = []
            for _, row in top_rules.iterrows():
                quality = 'Excellent' if row['lift'] > 2 and row['confidence'] > 0.8 else \
                         'Good' if row['lift'] > 1.5 and row['confidence'] > 0.6 else \
                         'Moderate' if row['lift'] > 1.2 and row['confidence'] > 0.5 else 'Weak'

                rules_analysis['top_rules'].append({
                    'antecedents': list(row['antecedents']),
                    'consequents': list(row['consequents']),
                    'support': float(row['support']),
                    'confidence': float(row['confidence']),
                    'lift': float(row['lift']),
                    'quality': quality
                })

        return jsonify({
            'analytics': analytics,
            'rules_analysis': rules_analysis
        })

    except Exception as e:
        return jsonify({'error': f'Error generating analytics: {str(e)}'}), 500

@app.route('/concept-lattice', methods=['POST'])
def generate_concept_lattice():
    global processed_transactions

    try:
        if processed_transactions is None:
            return jsonify({'error': 'No data uploaded. Please upload a file first.'}), 400

        data = request.get_json()
        max_concepts = data.get('max_concepts', 50)

        # Build concept lattice
        context = processed_transactions.values
        objects = [f"T{i}" for i in range(len(context))]
        attributes = list(processed_transactions.columns)

        lattice = build_concept_lattice(context, objects, attributes, max_concepts)
        lattice_json = lattice_to_json(lattice)

        return jsonify({
            'lattice': lattice_json,
            'stats': {
                'total_concepts': len(lattice.concepts) if hasattr(lattice, 'concepts') else 0,
                'objects_count': len(objects),
                'attributes_count': len(attributes)
            }
        })

    except Exception as e:
        return jsonify({'error': f'Error generating concept lattice: {str(e)}'}), 500

# This is required for Vercel - export the Flask app
app_instance = app

# For local development
if __name__ == '__main__':
    app.run(debug=True)
