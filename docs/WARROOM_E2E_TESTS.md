# WarRoom E2E Tests

Last updated: 2026-02-18

## Purpose

Provide a deterministic end-to-end regression harness for post-MVP WarRoom operator workflow foundations.

## Test command

```bash
cd /Users/moldovancsaba/Projects/mvp-factory-control/apps/warroom
npm run e2e:warroom
```

Filesystem safety harness command:

```bash
cd /Users/moldovancsaba/Projects/mvp-factory-control/apps/warroom
npm run e2e:filesystem-safety
```

DLP guardrail harness command:

```bash
cd /Users/moldovancsaba/Projects/mvp-factory-control/apps/warroom
npm run e2e:dlp-guardrail
```

Recovery readiness harness command:

```bash
cd /Users/moldovancsaba/Projects/mvp-factory-control/apps/warroom
npm run e2e:recovery-readiness
```

## What the harness validates

The script (`apps/warroom/scripts/e2e/warroom-postmvp.e2e.js`) runs:

1. tool-call protocol + policy contract checks.
2. filesystem + shell execution path (including streamed shell output callback).
3. git workflow path (status, protected-branch guard, checkout, add, commit, push to local bare remote).
4. rollback cleanup verification for temporary rehearsal workspaces.

Filesystem safety script (`apps/warroom/scripts/e2e/warroom-filesystem-safety.e2e.js`) runs:

1. happy-path filesystem operations: `list/read/search/edit/write/mkdir`.
2. workspace safety denials: traversal (`OUTSIDE_WORKSPACE`), direct symlink (`SYMLINK_DENIED`), symlink escape (`SYMLINK_ESCAPE`).
3. binary safety denials for text operations (`BINARY_DENIED`).
4. mutation policy requirement checks (`FILESYSTEM_MUTATION` requires approval).
5. rollback cleanup verification for temporary safety test workspaces.

DLP safety script (`apps/warroom/scripts/e2e/warroom-dlp-guardrail.e2e.js`) runs:

1. redact mode detection and replacement checks for sensitive patterns.
2. deny mode blocking checks (`[DLP_BLOCKED]` behavior).
3. off mode pass-through checks.
4. deterministic output/match/rule-id checks for repeated input.

Recovery readiness script (`apps/warroom/scripts/e2e/warroom-recovery-readiness.e2e.js`) runs:

1. backup snapshot + manifest generation with hash inventory.
2. backup integrity verification (checksum replay).
3. isolated restore rehearsal into temp workspace.
4. redacted incident evidence bundle generation from telemetry (database or fixture mode).
5. readiness pass/fail rubric checks with operator checklist output.

Output is emitted as structured JSON and command exits non-zero on failure.

## Safety posture

- test work is isolated to temporary OS directories.
- no secrets are required for baseline run.
- no destructive operations are performed on project workspace.

## Notes

- this harness is a local/CI-safe deterministic regression baseline.
- filesystem safety harness is CI-wired via:
  - `.github/workflows/warroom-filesystem-safety-gate.yml`
- DLP guardrail harness is CI-wired via:
  - `.github/workflows/warroom-dlp-guardrail-gate.yml`
- recovery readiness harness is CI-wired via:
  - `.github/workflows/warroom-recovery-readiness-gate.yml`
- runtime GitHub PR publishing and runtime issue-evidence network posting remain separately validated through operational issue evidence in the launch lane (`#137`, `#138`).

## Latest run evidence

Latest verified run (local):
- run id: `warroom-e2e-2026-02-18T09:56:33.277Z`
- command: `npm run e2e:warroom`
- result: PASS
- stage highlights:
  - protocol: `policyRequiresApproval=true`, `highestRiskClass=CRITICAL`
  - shell stream events: `2`
  - git protected branch guard: `PROTECTED_BRANCH_DENIED`
  - rollback cleanup: `workspaceRemoved=true`, `gitRootRemoved=true`

Latest filesystem safety run (local):
- run id: `warroom-filesystem-safety-e2e-2026-02-13T20:54:11.204Z`
- command: `npm run e2e:filesystem-safety`
- result: PASS
- highlights:
  - traversal/symlink/binary denials: `OUTSIDE_WORKSPACE`, `SYMLINK_DENIED`, `SYMLINK_ESCAPE`, `BINARY_DENIED`
  - mutation policy: `FILESYSTEM_MUTATION` requires approval

Latest DLP guardrail run (local):
- run id: `warroom-dlp-guardrail-e2e-2026-02-13T21:00:48.529Z`
- command: `npm run e2e:dlp-guardrail`
- result: PASS
- highlights:
  - redact/deny/off modes verified
  - deterministic output/match/rule-id behavior verified

Latest recovery readiness run (local):
- run id: `warroom-recovery-readiness-e2e-2026-02-18T09:09:36.566Z`
- command: `npm run e2e:recovery-readiness`
- result: PASS
- highlights:
  - backup manifest integrity verified
  - isolated restore drill verified
  - redacted incident bundle generated with schema v1.0
