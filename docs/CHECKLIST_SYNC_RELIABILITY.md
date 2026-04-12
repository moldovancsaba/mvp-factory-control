# Checklist Sync Reliability

**Scope:** Operational model for the Checklist worker and supervision. It does not replace per-module comments in `scripts/control_mvp.py`, `scripts/bootstrap.sh`, or `apps/mvp-factory-control` for how the tray starts services.

This document captures the operational reliability rules for the Checklist local AI worker.

The current design is intentionally narrow:

- hosted Checklist web app,
- online PostgreSQL database,
- local Ollama,
- one local Checklist worker supervised by `mvp-factory-control`.

## Reliability Scope

Relevant local components:

1. `scripts/control_mvp.py`
   Supervises the local Checklist worker and Ollama.
2. `scripts/checklist-sync/sync.js`
   The Checklist local AI worker on port `10005`.
3. `scripts/agent_connector_server.py`
   Exposes direct local health visibility for Ollama and the Checklist worker.

## Production Reliability Rules

### 1. The hosted app must never depend on localhost

The hosted web app writes to the online database and reads from the online database.

It does not require:

- a public tunnel to `127.0.0.1`,
- a local WebSocket gateway,
- a browser-to-local connector.

### 2. The database is the system-of-record contract

Everything that matters must be persisted online:

- raw product, customer, competitor, and uploaded-file data,
- flashcards,
- flashcard actions,
- recommendations,
- recommendation feedback,
- review and status changes.

### 3. The local AI runtime is only Ollama plus one worker

Checklist does not require OpenClaw to operate.

The worker must:

- poll the online database,
- generate flashcards from raw sources,
- generate recommendations from active flashcards,
- write results back to the database.

### 4. `mvp-factory-control` is responsible for worker supervision

Checklist reliability depends on the control plane automatically managing:

- Ollama,
- the Checklist worker,
- local health visibility.

Operationally the supervisor must also:

- prevent Checklist env variables from leaking into unrelated local services,
- detect stale Checklist worker launches whose live health/settings no longer match control-panel settings,
- replace those stale launches automatically instead of accepting “process exists” as healthy.

### 5. The worker must use a stable local model

Checklist standard local model:

- `gemma4:latest`

The worker should fail clearly if the configured model is not installed or Ollama is unavailable.

### 6. Human review must be preserved

The worker must not silently destroy reviewed state.

Operationally that means:

- worker-generated flashcards use fingerprints,
- superseded generated flashcards are marked stale,
- recommendation states such as `ACCEPTED`, `DECLINED`, and `COMPLETED` remain intact,
- source lineage remains available in `FlashcardSource`.

### 7. Research must be explicit, bounded, and survivable

Checklist may run a public research phase, but only as an explicitly enabled worker capability.

Operationally that means:

- the worker still functions when research is disabled,
- the worker still functions when research fetches fail,
- web discovery and page fetch counts are bounded,
- fact-check rules are deterministic,
- citations and evidence timestamps are recorded in `Flashcard.evidence`.

### 8. Research refresh must be independent from raw-row changes

Useful public information changes over time even when user-uploaded data does not.

The worker must therefore support scheduled evidence refreshes so it can:

- re-check key sources,
- discover newer public information,
- refresh flashcards and recommendations on a controlled cadence.

## Checklist `.env` precedence (local supervisor)

`mvp-factory-control` loads this repository’s `.env` first using non-destructive defaults (`setdefault` semantics). Each resolved Checklist env file is then loaded in order; for **Checklist-owned keys** (`DATABASE_URL`, `NEON_DB`, `LOCAL_SYNC_URL`, `LOCAL_SYNC_SECRET`, `CHECKLIST_ENV_PATH`, and every `CHECKLIST_*` variable), **later Checklist files overwrite** earlier values so the sibling Checklist tree can override values that were only primed from the factory repo. Keys in the factory `.env` that are not Checklist-owned are never overwritten by Checklist files.

## Health Criteria

Checklist local AI is healthy when:

- Ollama is reachable through the MVP HTTPS gateway at `https://127.0.0.1:3443/ollama` (with `NODE_EXTRA_CA_CERTS` or equivalent trust for `.mvp-factory-control/tls/localhost-cert.pem`),
- the worker is reachable at `https://127.0.0.1:3443/checklistsync/health` (same TLS trust),
- the worker reports database readiness,
- the worker reports model readiness,
- if research is enabled, the worker reports research configuration,
- the worker health payload matches the active control-panel Checklist settings (see contract rules below),
- recent poll cycles complete without repeated generation errors.

### Health `settings.supervisorContractVersion`

The tray compares `/health` to the supervisor contract in `scripts/checklist_control_defaults.py` (`CHECKLIST_CONTRACT_VERSION`). The **full** contract (cadence intervals, fact-check floors, batch sizes, version field) is enforced only when the worker includes **every** extended `settings` key defined there (`CHECKLIST_HEALTH_EXTENDED_SETTING_KEYS`). If `supervisorContractVersion` is present but some extended keys are missing, the supervisor falls back to the **legacy** subset so a partially upgraded worker is not stuck in a restart loop.

Workers that omit `supervisorContractVersion` entirely are also checked with the legacy subset. When the parallel Checklist worker is ready for strict parity, it should emit the full extended mirror in `/health`.

Research on/off is controlled from Factory Settings (`checklistResearchEnabled`) and passed as `CHECKLIST_RESEARCH_ENABLED`; drift logic compares `researchEnabled` in `/health` to that setting.

### Behavioral stall restarts

When `/health` reports `progress.state` of `stuck-running` or `stalled-no-progress`, the supervisor may replace the worker. Stall-driven kills are **throttled** (at most four per rolling hour, at least 180 seconds apart) to reduce flapping if stall detection is noisy. Settings or research mismatches still replace the worker immediately.

## Failure Modes To Watch

### 1. Ollama is down

Effect:

- flashcard generation stops,
- recommendation generation stops,
- worker remains alive but degraded.

### 2. Model drift

Effect:

- worker requests a model that is not installed,
- generation fails despite Ollama being online.

Mitigation:

- standardize on `gemma4:latest`,
- surface model availability in health checks.

### 3. Database access loss

Effect:

- worker cannot read raw data or write results,
- poll loop becomes degraded.

Mitigation:

- explicit DB readiness checks,
- health output must expose the blocker.

### 4. Source changes are not reflected in derived outputs

Effect:

- stale flashcards or stale recommendations remain visible.

Mitigation:

- snapshot detection must include:
  - raw structured sources,
  - uploaded files,
  - flashcards,
  - flashcard actions,
- recommendation feedback,
- pending recommendation state.

### 5. Research provider degradation

Effect:

- public discovery returns no useful sources,
- fact-check status falls back to first-party-only or insufficient-evidence states,
- recommendations may rely on older grounded flashcards until refresh succeeds.

Mitigation:

- treat research as optional,
- bound fetch timeouts,
- store explicit evidence status,
- keep the worker healthy even when research fails.

### 6. Supervisor drift

Effect:

- the worker process is running, but with old env/settings,
- the dashboard or worker can look alive while using stale timeout, cadence, or research settings,
- other local services can inherit Checklist-only env and fail for unrelated reasons.

Mitigation:

- validate Checklist worker health against the expected control contract,
- restart stale workers automatically,
- sanitize env propagation so non-Checklist services do not inherit Checklist database/runtime vars.

### 7. Silent citation drift

Effect:

- flashcards look current but their evidence is stale,
- recommendations lag behind the public information environment.

Mitigation:

- enforce research refresh cadence,
- store research timestamps in evidence metadata,
- trigger refresh processing when evidence ages past the configured threshold.

## Operational Verification

Implementers should follow [`docs/CHECKLIST_WORKER_HEALTH_CONTRACT.md`](CHECKLIST_WORKER_HEALTH_CONTRACT.md) for the exact `/health` key set the supervisor understands.

The following checks should be considered the minimum operational audit:

- `curl --cacert .mvp-factory-control/tls/localhost-cert.pem -fsS https://127.0.0.1:3443/checklistsync/health`
- `python3 scripts/validate_checklist_worker_health.py --fixture scripts/fixtures/checklist_health_legacy_ok.json`
- `curl --cacert .mvp-factory-control/tls/localhost-cert.pem -fsS https://127.0.0.1:3443/ollama/api/tags`
- confirm `gemma4:latest` is installed
- confirm the worker can authenticate `/sync`
- confirm the worker can validate a company ID
- if research is enabled, confirm the worker can reach its configured research provider
- confirm generated flashcards contain evidence metadata and citations
- confirm recent polls complete without repeated JSON-generation failures

## Architectural Conclusion

Checklist reliability improves when the local AI system is treated as a background worker and not as an interactive gateway.

That is now the intended operating model.
