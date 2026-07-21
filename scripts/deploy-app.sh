#!/bin/sh
# Deploy the Klappn Next.js app worker to Cloudflare.
#
# vinext 0.0.54's `deploy` command is an unimplemented stub, so we replicate
# what it would do: build (the @cloudflare/vite-plugin, driven by main +
# assets + run_worker_first in wrangler.jsonc, produces the worker entry from
# worker/index.ts and the deploy config at dist/server/wrangler.json), then
# deploy that generated config with wrangler.
#
# Prereqs: wrangler logged into the right account; Hyperdrive + secrets already
# configured on the `klappn` worker.
set -e
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
cd "$(dirname "$0")/.."

echo "==> building"
npm run build

echo "==> deploying dist/server/wrangler.json"
npx wrangler deploy -c dist/server/wrangler.json
