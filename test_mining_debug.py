import requests
import json

def test_mining_with_universal_dataset():
    """Test pattern mining with the universal dataset"""
    
    # Read the universal dataset
    try:
        with open('../universal_dataset.csv', 'r') as f:
            csv_content = f.read()
        print(f"Dataset loaded successfully. First 200 chars:\n{csv_content[:200]}...")
        print(f"Total lines: {len(csv_content.strip().split('\n'))}")
    except FileNotFoundError:
        print("ERROR: universal_dataset.csv not found")
        return
    
    # Test upload endpoint
    print("\n=== TESTING UPLOAD ===")
    try:
        files = {'file': ('universal_dataset.csv', csv_content, 'text/csv')}
        response = requests.post('http://localhost:5000/api/upload', files=files)
        print(f"Upload Status: {response.status_code}")
        print(f"Upload Response: {response.json()}")
    except Exception as e:
        print(f"Upload Error: {e}")
        return
    
    # Test mining endpoint with specific parameters
    print("\n=== TESTING MINING ===")
    try:
        mining_data = {
            'min_support': 0.02,  # 2%
            'min_confidence': 0.5,  # 50%
            'algorithm': 'apriori'
        }
        response = requests.post('http://localhost:5000/api/mine', json=mining_data)
        print(f"Mining Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ SUCCESS!")
            print(f"Frequent Itemsets: {len(result.get('frequent_itemsets', []))}")
            print(f"Association Rules: {len(result.get('association_rules', []))}")
            
            # Show some sample results
            if result.get('frequent_itemsets'):
                print(f"\nSample Frequent Itemsets:")
                for i, itemset in enumerate(result['frequent_itemsets'][:5]):
                    print(f"  {i+1}. {itemset}")
            
            if result.get('association_rules'):
                print(f"\nSample Association Rules:")
                for i, rule in enumerate(result['association_rules'][:5]):
                    print(f"  {i+1}. {rule}")
        else:
            print(f"❌ MINING FAILED")
            print(f"Error Response: {response.text}")
    except Exception as e:
        print(f"Mining Error: {e}")

if __name__ == "__main__":
    test_mining_with_universal_dataset()