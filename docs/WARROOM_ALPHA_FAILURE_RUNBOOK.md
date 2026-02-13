# WarRoom Alpha Failure Runbook (MVP)

Version: `v1`
Scope: Alpha/orchestrator failure handling and deterministic fallback policy

## Failure Taxonomy and Fallback Table

| Failure Class | Severity | Trigger | Deterministic Fallback | Operator Remediation |
|---|---|---|---|---|
| `LEASE_AUTHORITY_UNAVAILABLE` | HIGH | Orchestrator lease health is `STALE` or `UNHELD` when scope expansion is requested | Convert requested enqueue to `MANUAL_REQUIRED` fallback task | Restore ALPHA lease ownership (start/recover ALPHA worker), then resume autonomous queueing |
| `CONTEXT_GUARDRAIL_BLOCKED` | MEDIUM | Context usage at/above block threshold without valid handover package | Convert requested enqueue to `MANUAL_REQUIRED` fallback task | Record valid handover package + continuation prompt, or apply bounded audited override |
| `CONTEXT_GUARDRAIL_WARNING` | LOW | Context usage near threshold (`>=60%`) | Alert-only event + operator warning message | Prepare package before reaching 70% block threshold |
| `STALE_RUNNING_DETECTED` | MEDIUM | Running task exceeds stale-running threshold | Recovery path re-queues stale running tasks | Verify lease/worker health before reattempt |
| `EXECUTION_RETRY_EXHAUSTED` | HIGH | Runtime task exceeds retry budget | Task moved to `DEAD_LETTER` | Review diagnostics and create manual remediation task |

## Operator Signals

- Issue thread receives `SYSTEM` fallback alerts with failure class, fallback action, and remediation guidance.
- Dashboard introspection shows aggregate fallback event indicators (recent/high-severity/latest class).
- API snapshot (`/api/orchestrator/state`) includes failure-event summary for diagnostics and handover.

## Audit Guarantees

- Every failure fallback writes `AlphaFailureEvent` with class/severity/fallback/remediation metadata.
- Manual fallback tasks are persisted as `MANUAL_REQUIRED` (no silent drops).
- Lifecycle and context audit logs remain linked to fallback outcomes.
