#!/usr/bin/env bash
# scripts/dev.sh — one-command Court Vision dev startup (macOS / Linux)
#
# Starts:
#   - backend FastAPI on :8765 (mock mode unless backend/.env has keys)
#   - Expo dev server on :8081
#
# Usage:
#   ./scripts/dev.sh             # both
#   ./scripts/dev.sh backend     # just backend
#   ./scripts/dev.sh app         # just Expo

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-both}"

start_backend() {
  echo "→ backend on http://127.0.0.1:8765"
  cd "$ROOT/backend"
  if [ ! -d .venv ]; then
    python3 -m venv .venv
    ./.venv/bin/pip install -e .
  fi
  ./.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8765 --reload &
  BACKEND_PID=$!
  echo "  (pid $BACKEND_PID)"
}

start_app() {
  echo "→ Expo dev server"
  cd "$ROOT/app"
  npx expo start --web
}

case "$MODE" in
  backend) start_backend; wait ;;
  app)     start_app ;;
  both)    start_backend; trap "kill $BACKEND_PID 2>/dev/null || true" EXIT; start_app ;;
  *)       echo "usage: $0 [backend|app|both]"; exit 1 ;;
esac
