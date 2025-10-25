#!/bin/bash
# --- Deployment Script for CI/CD Pipeline ---
VENV_PATH="Form4Tracker/backend/.venv/bin/activate"

echo "Navigating to project directory: $PROJECT_DIR"
cd "$PROJECT_DIR" || exit

echo "Starting git pull..."
git pull origin main

echo "Activating virtual environment and installing dependencies..."
source "$VENV_PATH"

pip install -r backend/requirements.txt

# --- Application Restart ---
echo "Restarting application via PM2..."

pm2 restart form4-backend

echo "Deployment finished successfully."
