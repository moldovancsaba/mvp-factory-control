# Checklist worker `/health` contract

This document is the **implementation target** for the Checklist app’s local worker (`scripts/sync.js` or equivalent). The `mvp-factory-control` tray compares live `/health` JSON to control-panel settings using the same key sets defined in code.

**Canonical definitions** (Python, this repo):

- `CHECKLIST_CONTRACT_VERSION`, `CHECKLIST_HEALTH_LEGACY_SETTING_KEYS`, `CHECKLIST_HEALTH_EXTENDED_SETTING_KEYS` — [`scripts/checklist_control_defaults.py`](../scripts/checklist_control_defaults.py)
- Drift logic — `checklist_settings_drift_reason()` in that module

## Top level

| Field | Type | Required |
|-------|------|------------|
| `researchEnabled` | boolean (JSON `true`/`false`; string tolerated by supervisor) | yes |
| `settings` | object | yes |

Optional fields (`progress`, database/model readiness, etc.) are fine; the supervisor uses `progress` for behavioral stall detection when present.

## `settings` — legacy parity (always)

When `settings` does **not** include `supervisorContractVersion`, or includes it but **not every** key in `CHECKLIST_HEALTH_EXTENDED_SETTING_KEYS`, the tray compares only **legacy** keys. The worker **must** include all of the following keys (names and types must match what the supervisor expects after JSON parse — integers may arrive as floats; booleans as strings are normalized for `researchEnabled` only at top level):

- `schedulingMode` — string, e.g. `"company-serial-cycle"`
- `companyCycleCooldownMs` — integer (ms)
- `researchHarvestBatchSize` — integer
- `ollamaTimeoutMs` — integer
- `failsafeModel` — string
- `failsafeTimeoutMs` — integer
- `failsafeMaxAttempts` — integer
- `taskMinIceScore` — integer
- `flashcardMinConfidence`, `flashcardMinImpact`, `flashcardMinWeight` — integers
- `stuckRunningMs`, `noProgressMs` — integers (ms)
- `flashcardRevisitBatchSize`, `taskRevisitBatchSize`, `feedbackReplayBatchSize`, `hashtagMaintenanceBatchSize`, `cleanupBatchSize` — integers

Values must match the effective control-panel configuration (see `expected_checklist_worker_contract()` in the same module).

## `settings` — full extended parity (opt-in)

If and only if **every** key in `CHECKLIST_HEALTH_EXTENDED_SETTING_KEYS` is present, the supervisor also compares:

- `supervisorContractVersion` — integer, must equal `CHECKLIST_CONTRACT_VERSION` in this repo for a match
- `flashcardRevisitIntervalMinutes`, `taskRevisitIntervalMinutes`, `feedbackReplayIntervalMinutes` — integers
- `hashtagMaintenanceIntervalHours`, `cleanupIntervalHours` — integers
- `factcheckMinCitations`, `factcheckMinDomains` — integers

Implement the worker so that:

1. It always emits the **legacy** set (minimum).
2. When you are ready for strict parity with Factory Settings cadence + fact-check UI, emit **all** extended keys together with `supervisorContractVersion: 1` (or bump in lockstep with `CHECKLIST_CONTRACT_VERSION` here).

## Example payloads

See:

- [`scripts/fixtures/checklist_health_legacy_ok.json`](../scripts/fixtures/checklist_health_legacy_ok.json)
- [`scripts/fixtures/checklist_health_full_ok.json`](../scripts/fixtures/checklist_health_full_ok.json)

## Local verification

```bash
# Shape-only (fixtures; run from repo root)
python3 scripts/validate_checklist_worker_health.py --fixture scripts/fixtures/checklist_health_legacy_ok.json
python3 scripts/validate_checklist_worker_health.py --fixture scripts/fixtures/checklist_health_full_ok.json --strict-extended

# Live worker via HTTPS gateway
CHECKLIST_HEALTH_URL="https://127.0.0.1:3443/checklistsync/health" \
CHECKLIST_TLS_CA=".mvp-factory-control/tls/localhost-cert.pem" \
python3 scripts/validate_checklist_worker_health.py --url "$CHECKLIST_HEALTH_URL" --cacert "$CHECKLIST_TLS_CA"
```

## HTTP endpoint

- Default local worker: `http://127.0.0.1:10005/health`
- Via gateway (TLS): `https://127.0.0.1:3443/checklistsync/health` (same JSON body)
