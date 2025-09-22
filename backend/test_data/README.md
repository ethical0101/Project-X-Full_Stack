# Test Data Documentation

This directory contains comprehensive test datasets for the Frequent Pattern Mining application. These datasets are designed to showcase different scenarios and pattern types for presentation purposes.

## Dataset Files

### 1. super_patterns.json/csv (🏆 BEST FOR GUARANTEED RULES)
- **Format**: JSON array or CSV with transaction_id and comma-separated items
- **Size**: 50 transactions
- **Purpose**: Maximum pattern frequency for guaranteed association rules
- **Features**:
  - Extremely high-frequency combinations (milk+bread appears 10+ times)
  - 100% guaranteed association rules generation
  - Perfect for demonstrations and presentations
  - Simple, clear patterns that are easy to interpret
- **Recommended Settings**: Support=0.1, Confidence=0.5
- **Expected Rules**: milk→bread (95%+), coffee→sugar (90%+), pasta→cheese (85%+)

### 2. optimal_patterns.json/csv (⭐ RECOMMENDED FOR PRESENTATION)
- **Format**: JSON array or CSV with transaction_id and comma-separated items
- **Size**: 53 transactions
- **Purpose**: Specifically designed for strong association rule discovery
- **Features**:
  - High-frequency item combinations (milk+bread, coffee+sugar, etc.)
  - Guaranteed association rules with default thresholds
  - Perfect for visualization demonstrations
  - Clear, interpretable patterns
- **Recommended Settings**: Support=0.05, Confidence=0.3

### 2. large_transactions.csv
- **Format**: CSV with transaction_id and comma-separated items
- **Size**: 500 transactions
- **Purpose**: Large-scale testing with diverse product combinations
- **Features**:
  - Wide variety of food and beverage items
  - International cuisine combinations
  - Different product categories (dairy, meat, beverages, etc.)
  - Realistic shopping patterns

### 3. large_transactions.json
- **Format**: JSON array of item lists
- **Size**: 250 transactions
- **Purpose**: Alternative format for JSON-based processing
- **Features**: Same diverse product combinations as CSV

### 4. rich_transactions.json
- **Format**: Detailed JSON with complete transaction metadata
- **Size**: 10 sample transactions
- **Purpose**: Demonstrates rich transaction data with full context
- **Features**:
  - Transaction IDs, customer IDs, timestamps
  - Store locations, payment methods
  - Item quantities, prices, categories
  - Customer types, seasonal data
  - Total amounts and derived metrics

## Usage Scenarios

### For Presentations:
1. **Basic Pattern Mining**: Use large_transactions.csv for demonstrating frequent itemsets
2. **Algorithm Comparison**: Show differences between Apriori and FP-Growth
3. **Threshold Effects**: Demonstrate how support/confidence thresholds affect results
4. **Rich Analytics**: Use rich_transactions.json for advanced visualizations

### Expected Patterns:
- **Common Combinations**: Milk + Bread, Coffee + Sugar, Pasta + Cheese
- **Category Patterns**: Dairy products often purchased together
- **Cuisine Groupings**: Italian (Pasta, Cheese, Basil), Asian (Rice, Soy Sauce)
- **Breakfast Sets**: Milk + Cereal + Fruits
- **Party Combinations**: Beer + Chips + Snacks

### Recommended Settings:
- **Minimum Support**: 0.02-0.05 (1-2.5% of transactions)
- **Minimum Confidence**: 0.3-0.7 (30-70%)
- **Maximum Items**: 3-5 for meaningful patterns

## File Structure Benefits:
1. **Scalability Testing**: Large datasets show performance
2. **Pattern Diversity**: Wide variety ensures interesting results
3. **Real-world Simulation**: Realistic shopping behaviors
4. **Presentation Ready**: Clear, meaningful patterns for demos
