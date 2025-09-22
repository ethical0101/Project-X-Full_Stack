# Support and Confidence Recommendation Guide

## 📊 **Dataset Analysis: fixed_test_data.csv**

**Your Dataset:**
- **Total Transactions**: 6
- **Unique Items**: milk, bread, butter, coffee, sugar, cream
- **Transaction Patterns**:
  1. milk,bread (2 items)
  2. milk,bread,butter (3 items)
  3. milk,butter (2 items)
  4. bread,butter (2 items)
  5. coffee,sugar (2 items)
  6. coffee,sugar,cream (3 items)

**Item Frequencies:**
- milk: appears in 3/6 transactions = 50% support
- bread: appears in 3/6 transactions = 50% support
- butter: appears in 3/6 transactions = 50% support
- coffee: appears in 2/6 transactions = 33% support
- sugar: appears in 2/6 transactions = 33% support
- cream: appears in 1/6 transactions = 17% support

## 🎯 **Recommended Settings for Your Data**

### **Option 1: Conservative (Find Strong Patterns)**
```
Minimum Support: 0.4 (40%)
Minimum Confidence: 0.8 (80%)
Algorithm: Apriori
```
**Expected Results:**
- **Frequent Itemsets**: 3-5 itemsets
- **Association Rules**: 2-4 strong rules
- **Examples**: milk→bread (high confidence), butter→milk (high confidence)

### **Option 2: Balanced (Recommended)**
```
Minimum Support: 0.3 (30%)
Minimum Confidence: 0.6 (60%)
Algorithm: Apriori
```
**Expected Results:**
- **Frequent Itemsets**: 6-8 itemsets
- **Association Rules**: 4-8 meaningful rules
- **Examples**: coffee→sugar, milk→butter, bread→butter

### **Option 3: Exploratory (Find All Patterns)**
```
Minimum Support: 0.2 (20%)
Minimum Confidence: 0.5 (50%)
Algorithm: Apriori
```
**Expected Results:**
- **Frequent Itemsets**: 8-12 itemsets
- **Association Rules**: 8-15 rules (including weaker ones)
- **Examples**: All combinations including cream-based patterns

## 📈 **Step-by-Step Analysis**

### **Step 1: Calculate Support for Each Item**
| Item | Frequency | Support | Include in Results? |
|------|-----------|---------|-------------------|
| milk | 3/6 | 50% | ✅ All thresholds |
| bread | 3/6 | 50% | ✅ All thresholds |
| butter | 3/6 | 50% | ✅ All thresholds |
| coffee | 2/6 | 33% | ✅ If support ≤ 0.3 |
| sugar | 2/6 | 33% | ✅ If support ≤ 0.3 |
| cream | 1/6 | 17% | ✅ If support ≤ 0.17 |

### **Step 2: Calculate Support for 2-Itemsets**
| Itemset | Frequency | Support | Include in Results? |
|---------|-----------|---------|-------------------|
| {milk, bread} | 2/6 | 33% | ✅ If support ≤ 0.33 |
| {milk, butter} | 2/6 | 33% | ✅ If support ≤ 0.33 |
| {bread, butter} | 2/6 | 33% | ✅ If support ≤ 0.33 |
| {coffee, sugar} | 2/6 | 33% | ✅ If support ≤ 0.33 |
| {coffee, cream} | 1/6 | 17% | ✅ If support ≤ 0.17 |
| {sugar, cream} | 1/6 | 17% | ✅ If support ≤ 0.17 |

### **Step 3: Predict Association Rules**
With **Support=0.3, Confidence=0.6**:

**Strong Rules (High Confidence):**
- coffee → sugar: confidence = 2/2 = 100% ✅
- sugar → coffee: confidence = 2/2 = 100% ✅
- milk+bread → butter: confidence = 1/2 = 50% ❌
- butter → milk: confidence = 2/3 = 67% ✅

## 🎯 **My Recommendation for Your Dataset**

**Use These Settings:**
```
Minimum Support: 0.3 (30%)
Minimum Confidence: 0.6 (60%)
Algorithm: Apriori
```

**Why These Settings:**
1. **Support 0.3**: Captures meaningful patterns (items appearing in 2+ transactions)
2. **Confidence 0.6**: Ensures rules are reliable (60%+ accuracy)
3. **Apriori**: Better for small datasets, easier to interpret

**Expected Output:**
- **6-8 frequent itemsets** including singles, pairs, and possibly triples
- **4-8 association rules** with good reliability
- **Clear patterns** like coffee-sugar relationship, dairy-bakery patterns

## 🔍 **How to Adjust Based on Results**

### **If Too Few Results:**
- **Lower Support**: Try 0.25 or 0.2
- **Lower Confidence**: Try 0.5

### **If Too Many Results:**
- **Raise Support**: Try 0.4 or 0.5
- **Raise Confidence**: Try 0.7 or 0.8

### **For Better Performance:**
- **Small datasets (< 100)**: Support 0.2-0.4
- **Medium datasets (100-1000)**: Support 0.05-0.2
- **Large datasets (> 1000)**: Support 0.01-0.05

## 🚀 **Quick Start Instructions**

1. **Open Data Upload tab** (📁)
2. **Set parameters**:
   - Minimum Support: **0.3**
   - Minimum Confidence: **0.6**
   - Algorithm: **Apriori**
3. **Upload**: `fixed_test_data.csv`
4. **Click**: "Mine Patterns"
5. **Review results** in Dashboard and Visualizations
6. **Adjust** if needed based on number of results

**Start with these settings and adjust based on your results!**
