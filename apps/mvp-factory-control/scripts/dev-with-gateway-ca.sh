#!/usr/bin/env bash
# Next.js dev with NODE_EXTRA_CA_CERTS so server-side fetches to https://127.0.0.1:<gateway>/ollama succeed.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
export NODE_EXTRA_CA_CERTS="${NODE_EXTRA_CA_CERTS:-$REPO_ROOT/.mvp-factory-control/tls/localhost-cert.pem}"
export MVP_HTTPS_GATEWAY_PORT="${MVP_HTTPS_GATEWAY_PORT:-3443}"
cd "$(dirname "$0")/.."
exec pnpm exec next dev -p 3007
