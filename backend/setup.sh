#!/bin/bash

echo "Setting up Python environment for Flask backend..."

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
python -m pip install --upgrade pip

# Install requirements
pip install -r requirements.txt

echo ""
echo "Setup complete! To start the backend server:"
echo "1. Run: source venv/bin/activate"
echo "2. Run: python app.py"
echo ""
echo "The backend will be available at http://localhost:5000"
