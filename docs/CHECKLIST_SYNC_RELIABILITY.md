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

## Health Criteria

Checklist local AI is healthy when:

- Ollama is reachable on `http://127.0.0.1:11434`,
- the worker is reachable on `http://127.0.0.1:10005/health`,
- the worker reports database readiness,
- the worker reports model readiness,
- if research is enabled, the worker reports research configuration,
- recent poll cycles complete without repeated generation errors.

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

### 6. Silent citation drift

Effect:

- flashcards look current but their evidence is stale,
- recommendations lag behind the public information environment.

Mitigation:

- enforce research refresh cadence,
- store research timestamps in evidence metadata,
- trigger refresh processing when evidence ages past the configured threshold.

## Operational Verification

The following checks should be considered the minimum operational audit:

- `GET http://127.0.0.1:10005/health`
- `GET http://127.0.0.1:11434/api/tags`
- confirm `gemma4:latest` is installed
- confirm the worker can authenticate `/sync`
- confirm the worker can validate a company ID
- if research is enabled, confirm the worker can reach its configured research provider
- confirm generated flashcards contain evidence metadata and citations
- confirm recent polls complete without repeated JSON-generation failures

## Architectural Conclusion

Checklist reliability improves when the local AI system is treated as a background worker and not as an interactive gateway.

That is now the intended operating model.
