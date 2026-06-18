#!/usr/bin/env bash
# Dev launcher: sets PYTHONPATH and starts uvicorn with reload.
# Usage: ./scripts/dev.sh
set -euo pipefail
cd "$(dirname "$0")/.."

# Pick port from env or default.
PORT="${CV_PORT:-8765}"

# Activate venv if it exists at /tmp (per project convention).
if [ -d /tmp/jfvenv ] && [ -z "${VIRTUAL_ENV:-}" ]; then
  source /tmp/jfvenv/bin/activate
fi

exec uvicorn app.main:app --host 127.0.0.1 --port "$PORT" --reload
