# WarRoom Recovery Readiness Runbook

Last updated: 2026-02-18
Scope: `apps/warroom`

## Objective

Provide a repeatable recovery program that validates backup artifact integrity, rehearses restore in an isolated workspace, and emits a redacted incident evidence bundle.

## Commands

Run recovery readiness drill:

```bash
cd /Users/moldovancsaba/Projects/mvp-factory-control/apps/warroom
npm run e2e:recovery-readiness
```

Generate incident bundle manually:

```bash
cd /Users/moldovancsaba/Projects/mvp-factory-control/apps/warroom
npm run recovery:incident-bundle -- --issue 120 --since-hours 168 --out .warroom/recovery/incident-bundle.json
```

## Modes

- `WARROOM_RECOVERY_DRILL_MODE=AUTO` (default): use database telemetry when available, fallback to fixture.
- `WARROOM_RECOVERY_DRILL_MODE=DATABASE`: require database telemetry; fail if unavailable.
- `WARROOM_RECOVERY_DRILL_MODE=FIXTURE`: deterministic fixture telemetry only.

## Drill Stages

1. Backup snapshot capture
- collect runtime env-presence map and telemetry payload.
- write `state-snapshot.json` and `manifest.json` with SHA-256 hash.

2. Integrity validation
- recompute hashes from manifest and fail on mismatch.

3. Isolated restore rehearsal
- copy backup artifacts into an isolated temp restore root.
- validate restored payload shape and runbook steps.

4. Incident evidence bundle
- generate bundle matching schema:
  - `apps/warroom/scripts/recovery/incident-bundle.schema.json`
- apply REDACT-mode DLP filtering for every string field.

## Pass/Fail Rubric

Pass requires all checks true:

- `backupIntegrityValidated`
- `restoreDrillIsolated`
- `incidentBundleGenerated`
- `redactionApplied`

Failure in any check marks readiness as failed.

## Operator Checklist

1. Run `npm run e2e:recovery-readiness`.
2. Capture run id and summary JSON.
3. Attach incident-bundle SHA-256 and run id in issue evidence comment.
4. Re-run after any runtime safety or schema-affecting change.

## Safety Rules

- no production mutation in drill (temp workspace only).
- no secret values are persisted; outputs are DLP-redacted.
- changes remain additive/reversible and auditable.

## Scheduling

CI recurring schedule is defined in:

- `.github/workflows/warroom-recovery-readiness-gate.yml`

The workflow runs the fixture-mode drill weekly plus on-demand/workflow path changes.
