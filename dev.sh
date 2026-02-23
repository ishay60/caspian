#!/usr/bin/env bash
# Start Caspian backend + frontend dev servers
# Usage: ./dev.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Free ports so we don't get "Address already in use" from a previous run
for port in 8000 5173; do
  pids=$(lsof -ti :$port 2>/dev/null) || true
  if [ -n "$pids" ]; then
    echo "Stopping existing process(es) on port $port..."
    kill $pids 2>/dev/null || kill -9 $pids 2>/dev/null || true
    sleep 1
  fi
done

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
