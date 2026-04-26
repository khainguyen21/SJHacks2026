#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── Backend ──────────────────────────────────────────────────────────────────
echo "Installing Python dependencies..."
pip3 install -r "$ROOT/backend/requirements.txt" -q

echo "Starting backend on http://localhost:3000 ..."
cd "$ROOT/backend"
uvicorn api:app --port 3000 --reload &
BACKEND_PID=$!
cd "$ROOT"

# ── Frontend ─────────────────────────────────────────────────────────────────
echo "Installing Node dependencies..."
cd "$ROOT/frontend"
npm install -q

echo "Starting frontend on http://localhost:5173 ..."
npm run dev &
FRONTEND_PID=$!
cd "$ROOT"

# ── Cleanup on Ctrl-C ─────────────────────────────────────────────────────────
trap "echo ''; echo 'Shutting down...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

echo ""
echo "  Backend:  http://localhost:3000"
echo "  Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl-C to stop both servers."

wait
