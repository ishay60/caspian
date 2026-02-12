#!/usr/bin/env bash
# Start Caspian backend + frontend dev servers
# Usage: ./dev.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

cleanup() {
  echo ""
  echo "Shutting down..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
  wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
  echo "Done."
}
trap cleanup EXIT

# Backend
echo "Starting backend on http://localhost:8000 ..."
uv run uvicorn caspian.api:app --reload --port 8000 &
BACKEND_PID=$!

# Frontend
echo "Starting frontend on http://localhost:5173 ..."
cd frontend && npm run dev &
FRONTEND_PID=$!
cd "$SCRIPT_DIR"

echo ""
echo "  Open http://localhost:5173"
echo "  Press Ctrl+C to stop both servers."
echo ""

wait
