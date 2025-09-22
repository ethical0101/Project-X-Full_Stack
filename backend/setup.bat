@echo off
echo Setting up Python environment for Flask backend...

:: Create virtual environment
python -m venv venv

:: Activate virtual environment
call venv\Scripts\activate.bat

:: Upgrade pip
python -m pip install --upgrade pip

:: Install requirements
pip install -r requirements.txt

echo.
echo Setup complete! To start the backend server:
echo 1. Run: venv\Scripts\activate.bat
echo 2. Run: python app.py
echo.
echo The backend will be available at http://localhost:5000

pause
