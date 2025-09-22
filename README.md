# Frequent Pattern Mining Web Application

A full-stack web application for frequent pattern mining with interactive data visualization and analysis. This application provides a modern web interface for uploading transaction data, mining frequent patterns, and visualizing association rules.

## 🚀 Features

- **Interactive Data Upload**: Drag-and-drop interface for CSV and JSON files
- **Real-time Pattern Mining**: Support for both Apriori and FP-Growth algorithms
- **Formal Concept Analysis**: Complete concept lattice generation and visualization
- **Advanced Analytics**: Comprehensive metrics and performance analysis
- **Interactive Visualizations**: Multiple chart types for exploring patterns and rules
- **Concept Lattice Visualization**: Interactive network diagram of formal concepts
- **Responsive Design**: Modern UI with Tailwind CSS
- **RESTful API**: Flask backend with comprehensive endpoints

## 🏗️ Architecture

### Frontend (React + Next.js + TypeScript)
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript for type safety
- **Styling**: Tailwind CSS for modern design
- **Components**: Modular React components
- **State Management**: React hooks and context

### Backend (Python + Flask)
- **Framework**: Flask with CORS support
- **Libraries**: pandas, mlxtend, scikit-learn, numpy
- **Algorithms**: Apriori and FP-Growth implementations
- **API**: RESTful endpoints for data processing

## 📋 Prerequisites

- **Node.js** (v18 or later)
- **Python** (v3.8 or later)
- **npm** or **yarn**
- **pip** (Python package manager)

## 🛠️ Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/ethical0101/Project-X-Full_Stack.git
cd Project-X-Full_Stack
```

### 2. Frontend Setup
```bash
# Install frontend dependencies
npm install

# Start the development server
npm run dev
```
The frontend will be available at `http://localhost:3000`

### 3. Backend Setup

#### Windows:
```bash
cd backend
python -m venv venv
venv\Scripts\activate.bat
pip install -r requirements.txt
python app.py
```

#### Linux/macOS:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

The backend will be available at `http://localhost:5000`

## 📊 Usage

### 1. Data Upload
- Access the application at `http://localhost:3000`
- Use the upload interface to select a CSV or JSON file
- Supported formats:
  - **CSV**: Columns with transaction items
  - **JSON**: Array of transaction arrays

### 2. Pattern Mining
- Configure mining parameters:
  - **Minimum Support**: Threshold for frequent itemsets
  - **Minimum Confidence**: Threshold for association rules
  - **Algorithm**: Choose between Apriori or FP-Growth
- Click "Mine Patterns" to start the analysis

### 3. Results Exploration
- **Dashboard**: Overview of mining results and key metrics
- **Analytics**: Detailed performance and quality metrics
- **Visualizations**: Interactive charts and graphs
- **Concept Lattice**: Formal concept analysis with hierarchical visualization

## 🔧 API Endpoints

### Health Check
```
GET /api/health
```

### Data Upload
```
POST /api/upload
Content-Type: multipart/form-data
```

### Pattern Mining
```
POST /api/mine
Content-Type: application/json
{
  "min_support": 0.1,
  "min_confidence": 0.6,
  "algorithm": "apriori"
}
```

### Get Analytics
```
GET /api/analytics
```

### Get Results
```
GET /api/results
```

### Generate Concept Lattice
```
POST /api/concept-lattice
Content-Type: multipart/form-data
Body: file (CSV or JSON)
```

### Test Concept Lattice
```
GET /api/test-lattice
```

## 📁 Project Structure

```
Project-x_Full_Stack/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Main app layout
│   │   └── page.tsx            # Home page
│   ├── components/
│   │   ├── DataUpload.tsx      # File upload component
│   │   ├── Dashboard.tsx       # Results dashboard
│   │   ├── Analytics.tsx       # Analytics component
│   │   ├── Visualizations.tsx  # Interactive charts
│   │   └── ConceptLatticeAnalysis.tsx # FCA component
│   └── styles/
│       └── analytics.module.css # Custom styles
├── backend/
│   ├── app.py                  # Flask application
│   ├── fca.py                  # Formal Concept Analysis module
│   ├── requirements.txt        # Python dependencies
│   ├── setup.bat              # Windows setup script
│   ├── setup.sh               # Unix setup script
│   └── test_data/             # Sample data files
├── package.json               # Node.js dependencies
├── tsconfig.json             # TypeScript configuration
├── tailwind.config.js        # Tailwind CSS configuration
└── next.config.js            # Next.js configuration
```

## 🧪 Sample Data

The application includes sample transaction data for testing:

### transactions.csv
```csv
transaction_id,items
1,"['Milk', 'Eggs', 'Bread', 'Cheese']"
2,"['Milk', 'Bread']"
...
```

### transactions.json
```json
[
    ["Milk", "Eggs", "Bread", "Cheese"],
    ["Milk", "Bread"],
    ...
]
```

## 🔍 Algorithm Details

### Apriori Algorithm
- **Principle**: Generate frequent itemsets using bottom-up approach
- **Advantage**: Easy to understand and implement
- **Use Case**: Small to medium datasets

### FP-Growth Algorithm
- **Principle**: Use FP-tree structure for efficient mining
- **Advantage**: Faster performance, no candidate generation
- **Use Case**: Large datasets

### Formal Concept Analysis (FCA)
- **Principle**: Mathematical lattice structure of formal concepts
- **Algorithm**: Next Closure for complete concept enumeration
- **Output**: Hierarchical concept lattice with extent/intent pairs
- **Use Case**: Knowledge discovery, data structure analysis

## 🕸️ Concept Lattice Features

### Mathematical Foundation
- **Formal Context**: (Objects, Attributes, Incidence Relation)
- **Formal Concept**: (Extent, Intent) pairs
- **Concept Lattice**: Complete hierarchy of subconcept relationships

### Visualization
- **Interactive Network**: SVG-based lattice diagram
- **Color Coding**: Top (red), bottom (green), regular (blue) concepts
- **Click Navigation**: Detailed concept information
- **Hierarchical Layout**: Concepts arranged by attribute count

### Analysis Capabilities
- **Complete Structure**: All possible concepts, not just frequent ones
- **Relationship Discovery**: Subconcept/superconcept hierarchies
- **Knowledge Extraction**: Natural taxonomies in data

## 📈 Metrics & Analytics

### Quality Metrics
- **Support**: Frequency of itemset occurrence
- **Confidence**: Reliability of inference
- **Lift**: Strength of association
- **Conviction**: Directed implication strength
- **Leverage**: Difference from independence

### Performance Metrics
- **Mining Time**: Algorithm execution duration
- **Memory Usage**: Resource consumption
- **Scalability**: Performance with dataset size

## 🚀 Deployment

### Frontend Deployment
```bash
npm run build
npm start
```

### Backend Deployment
For production, use a WSGI server like Gunicorn:
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Troubleshooting

### Common Issues

1. **Port Already in Use**
   - Frontend: Change port in package.json or use `npm run dev -- -p 3001`
   - Backend: Modify port in app.py

2. **Python Environment Issues**
   - Ensure virtual environment is activated
   - Verify Python version compatibility
   - Check package installations

3. **CORS Errors**
   - Verify Flask-CORS is installed
   - Check API endpoint URLs

### Performance Optimization

1. **Large Datasets**
   - Increase minimum support threshold
   - Use FP-Growth algorithm
   - Consider data preprocessing

2. **Memory Usage**
   - Monitor virtual environment resources
   - Implement data chunking for large files

## 📞 Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the API documentation

---

**Built with ❤️ for data mining and pattern analysis**
