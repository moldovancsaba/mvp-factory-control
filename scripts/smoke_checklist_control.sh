#!/usr/bin/env bash
# Quick validation for Checklist control-plane helpers (no worker required).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PYTHONPATH="${ROOT}/scripts${PYTHONPATH:+:$PYTHONPATH}"
python3 -m unittest discover -s "${ROOT}/scripts/tests" -p 'test_*.py' -v

if [[ "${CHECKLIST_WORKER_SMOKE:-}" == "1" ]]; then
  if command -v curl >/dev/null 2>&1; then
    cert="${ROOT}/.mvp-factory-control/tls/localhost-cert.pem"
    if [[ -f "$cert" ]]; then
      curl --cacert "$cert" -fsS "https://127.0.0.1:${MVP_HTTPS_GATEWAY_PORT:-3443}/checklistsync/health" | head -c 400
      echo
    else
      echo "SKIP worker smoke: missing $cert" >&2
    fi
  fi
fi
