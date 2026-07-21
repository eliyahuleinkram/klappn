#!/bin/sh
# Launch the vinext dev server with Node 22 (the system Node is too old) and the
# local .env loaded into the process environment (Vite doesn't put server-side
# vars on process.env by itself).
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi
# Honor the harness-assigned PORT when set (autoPort), default to 3001.
exec npx vinext dev --port "${PORT:-3001}"
