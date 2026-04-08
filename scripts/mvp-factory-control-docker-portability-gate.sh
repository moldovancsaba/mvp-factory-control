#!/usr/bin/env bash

# Automated Docker portability gate for the internal control app.
# Validates compose parse + startup + health expectations with concise remediation output.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.yml"
PREFLIGHT_SCRIPT="$SCRIPT_DIR/mvp-factory-control-docker-preflight.sh"
BOOTSTRAP_SCRIPT="$SCRIPT_DIR/mvp-factory-control-docker-bootstrap.sh"

DB_PORT="${MVP_FACTORY_CONTROL_DB_PORT:-5432}"
APP_PORT="${MVP_FACTORY_CONTROL_APP_PORT:-3007}"
NEXTAUTH_URL_VALUE="${NEXTAUTH_URL:-http://localhost:${APP_PORT}}"

dc() {
  (
    cd "$REPO_ROOT"
    MVP_FACTORY_CONTROL_DB_PORT="$DB_PORT" \
    MVP_FACTORY_CONTROL_APP_PORT="$APP_PORT" \
    NEXTAUTH_URL="$NEXTAUTH_URL_VALUE" \
      docker compose -f "$COMPOSE_FILE" "$@"
  )
}

pass() {
  echo "[PASS] $1"
}

fail() {
  echo "[FAIL] $1"
  exit 1
}

health_status() {
  local container="$1"
  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container" 2>/dev/null || echo "missing"
}

assert_health() {
  local container="$1"
  local expected="$2"
  local actual
  actual="$(health_status "$container")"
  if [ "$actual" = "$expected" ]; then
    pass "${container} health=${actual}"
  else
    fail "${container} health expected=${expected}, actual=${actual}. Remediation: inspect container logs and rerun ./scripts/mvp-factory-control-docker-bootstrap.sh."
  fi
}

dump_diagnostics() {
  echo
  echo "---- portability gate diagnostics ----"
  dc ps || true
  echo
  docker logs --tail 80 mvp-factory-control-db 2>/dev/null || true
  echo
  docker logs --tail 80 mvp-factory-control-app 2>/dev/null || true
  echo "--------------------------------------"
}

cleanup() {
  local exit_code="$1"
  set +e
  if [ "$exit_code" -ne 0 ]; then
    dump_diagnostics
  fi
  dc down -v --remove-orphans >/dev/null 2>&1 || true
  if [ "$exit_code" -ne 0 ]; then
    echo "[FAIL] Internal control app Docker portability gate failed."
    echo "Remediation: run ./scripts/mvp-factory-control-docker-preflight.sh, then rerun ./scripts/mvp-factory-control-docker-bootstrap.sh."
  fi
}

trap 'rc=$?; cleanup "$rc"; exit "$rc"' EXIT

echo "Internal control app Docker portability gate"
echo "Repo: $REPO_ROOT"
echo "Ports: db=$DB_PORT app=$APP_PORT"
echo "NextAuth URL: $NEXTAUTH_URL_VALUE"
echo

[ -x "$PREFLIGHT_SCRIPT" ] || fail "Missing executable preflight script at scripts/mvp-factory-control-docker-preflight.sh."
[ -x "$BOOTSTRAP_SCRIPT" ] || fail "Missing executable bootstrap script at scripts/mvp-factory-control-docker-bootstrap.sh."
[ -f "$COMPOSE_FILE" ] || fail "Missing docker-compose.yml at repository root."

echo "[STEP] Preflight checks"
"$PREFLIGHT_SCRIPT"
echo

echo "[STEP] Compose parse check"
dc config -q
pass "docker compose config -q"
echo

echo "[STEP] Bootstrap stack and verify startup path"
"$BOOTSTRAP_SCRIPT"
echo

echo "[STEP] Assert expected healthy conditions"
assert_health "mvp-factory-control-db" "healthy"
assert_health "mvp-factory-control-app" "healthy"
echo

echo "[STEP] Assert expected unhealthy condition probe"
if curl -fsS "http://127.0.0.1:${APP_PORT}/__mvp-factory-control_missing_health_probe__" >/dev/null; then
  fail "Unexpected success for invalid endpoint probe. Health gate may be misconfigured."
fi
pass "Invalid endpoint probe failed as expected."
echo

pass "Internal control app Docker portability gate passed."
