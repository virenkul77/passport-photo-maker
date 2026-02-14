#!/bin/bash
set -e

echo "🔍 Checking for Python 3.11 installation..."

PY311_PATH=$(ls -d /usr/local/Cellar/python@3.11/*/bin/python3.11 2>/dev/null | head -n 1)

if [ -z "$PY311_PATH" ]; then
  echo "❌ Python 3.11 not found via Homebrew. Installing now..."
  brew install python@3.11
  PY311_PATH=$(ls -d /usr/local/Cellar/python@3.11/*/bin/python3.11 2>/dev/null | head -n 1)
fi

if [ ! -x "$PY311_PATH" ]; then
  echo "❌ Python 3.11 binary not found. Please check your Homebrew installation."
  exit 1
fi

echo "✅ Found Python 3.11 at: $PY311_PATH"

echo "📁 Creating virtual environment in ./venv..."
$PY311_PATH -m venv venv

echo "🚀 Activating virtual environment..."
source venv/bin/activate

echo "🔧 Upgrading pip..."
pip install --upgrade pip

echo "📦 Installing required libraries (Flask, Pillow)..."
pip install flask pillow rembg numpy torch transformers opencv-python onnxruntime

# 5️⃣ Freeze requirements
echo "🧾 Saving dependencies to requirements.txt..."
pip3 freeze > "$APP_DIR/requirements.txt"

echo "🧪 Verifying installation..."
python --version
pip list | grep -E 'Flask|Pillow'

echo "✅ Setup complete!"
echo ""
echo "To activate your environment later, run:"
echo "    source venv/bin/activate"
echo ""
echo "Then start your app with:"
echo "    python app.py"
