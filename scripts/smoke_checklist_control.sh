#!/usr/bin/env bash
# Quick validation for Checklist control-plane helpers (no worker required).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PYTHONPATH="${ROOT}/scripts${PYTHONPATH:+:$PYTHONPATH}"
python3 -m unittest discover -s "${ROOT}/scripts/tests" -p 'test_*.py' -v

# Fixture shape checks (same rules as supervisor drift key sets).
python3 "${ROOT}/scripts/validate_checklist_worker_health.py" \
  --fixture "${ROOT}/scripts/fixtures/checklist_health_legacy_ok.json"
python3 "${ROOT}/scripts/validate_checklist_worker_health.py" \
  --fixture "${ROOT}/scripts/fixtures/checklist_health_full_ok.json" --strict-extended

if [[ "${CHECKLIST_WORKER_SMOKE:-}" == "1" ]]; then
  cert="${ROOT}/.mvp-factory-control/tls/localhost-cert.pem"
  url="https://127.0.0.1:${MVP_HTTPS_GATEWAY_PORT:-3443}/checklistsync/health"
  if [[ -f "$cert" ]]; then
    python3 "${ROOT}/scripts/validate_checklist_worker_health.py" --url "$url" --cacert "$cert"
  else
    echo "SKIP live worker smoke: missing $cert" >&2
  fi
fi
