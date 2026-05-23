#!/usr/bin/env bash
#
# Build and (re)start Obol on a persistent host. Re-runnable: use it for the
# first deploy and for every update pull.
#
# Prerequisites (see deploy/VM-SETUP.md): Node 20+, pm2, caddy installed;
# repo cloned; .env present at the repo root; Gateway balance funded.
#
#   ./deploy/deploy.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  echo "ERROR: .env missing at repo root. Copy .env.example to .env and fill it in."
  exit 1
fi

echo "==> Installing dependencies"
npm install

echo "==> Building all workspaces"
npm run build

echo "==> Starting/reloading PM2 processes"
if pm2 describe obol-web >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save

echo "==> Done. Processes:"
pm2 status

cat <<'NOTE'

Next:
  - Ensure Caddy is running with PUBLIC_HOST set (see deploy/VM-SETUP.md).
  - Fund Obol's Gateway balance if you haven't:
      npm run gateway:deposit --workspace=@obol/payments -- 3.00
  - Set the live URL on GitHub:
      gh repo edit ajanaku1/obol --homepage "https://$PUBLIC_HOST"
NOTE
