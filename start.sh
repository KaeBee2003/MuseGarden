#!/usr/bin/env bash
set -e

# Run this from Git Bash, WSL, or another bash shell on Windows.
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Starting MuseGarden Electron desktop app..."
npx electron .
