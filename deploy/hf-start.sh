#!/bin/sh
# Container entrypoint: start the data market, then the web app in the
# foreground (so the container stays alive on the web process).
set -e

mkdir -p /tmp/obol

echo "Starting Obol data market on :4020..."
npm run start --workspace=@obol/data &

# Give the market a moment to bind before the web app discovers it.
sleep 4

echo "Starting Obol web app on :${PORT:-7860}..."
exec npm run start --workspace=@obol/frontend
