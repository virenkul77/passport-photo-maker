@echo off
REM ===========================================================
REM Passport Photo App Setup Script for Windows
REM Creates venv, installs dependencies, and runs Flask app
REM ===========================================================

setlocal enabledelayedexpansion

set "APP_DIR=%~dp0"
set "VENV_DIR=%APP_DIR%venv"

echo Setting up environment in: %APP_DIR%
echo ------------------------------------

REM 1. Create virtual environment if not exists
if not exist "%VENV_DIR%" (
  echo Creating virtual environment...
  python -m venv "%VENV_DIR%"
) else (
  echo Virtual environment already exists.
)

REM 2. Activate virtual environment
echo Activating virtual environment...
call "%VENV_DIR%\Scripts\activate.bat"

REM 3. Upgrade pip, setuptools, and wheel
echo Upgrading pip, setuptools, and wheel...
python -m pip install --upgrade pip setuptools wheel

REM 4. Install required libraries (using only binary wheels to avoid build issues)
echo Installing required Python packages...
pip install --only-binary :all: flask pillow opencv-python onnxruntime
pip install rembg

REM 5. Freeze requirements
echo Saving dependencies to requirements.txt...
pip freeze > "%APP_DIR%requirements.txt"

REM 6. Run Flask app
echo Starting the Passport Photo Maker app...
set FLASK_APP=app.py
set FLASK_ENV=development
python app.py

pause
