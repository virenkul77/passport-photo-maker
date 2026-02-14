#!/bin/bash
# ===========================================================
# Passport Photo App Setup Script for macOS
# Creates venv, installs dependencies, and runs Flask app
# ===========================================================

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$APP_DIR/venv"

echo "Setting up environment in: $APP_DIR"
echo "-------------------------------------"

# 1️⃣ Create virtual environment if not exists
if [ ! -d "$VENV_DIR" ]; then
  echo "🔧 Creating virtual environment..."
  python3 -m venv "$VENV_DIR"
else
  echo "Virtual environment already exists."
fi

# 2️⃣ Activate virtual environment
echo "⚙️  Activating virtual environment..."
source "$VENV_DIR/bin/activate"

# 3️⃣ Upgrade pip
echo "⬆️  Upgrading pip..."
pip3 install --upgrade pip

# 4️⃣ Install required libraries
echo "📦 Installing required Python packages..."
pip3 install flask pillow rembg numpy torch transformers opencv-python onnxruntime

# 5️⃣ Freeze requirements
echo "🧾 Saving dependencies to requirements.txt..."
pip3 freeze > "$APP_DIR/requirements.txt"

# 6️⃣ Run Flask app
echo "🚀 Starting the Passport Photo Maker app..."
export FLASK_APP=app.py
export FLASK_ENV=development
python3 app.py
