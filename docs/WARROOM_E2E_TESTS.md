# WarRoom E2E Tests

Last updated: 2026-02-13

## Purpose

Provide a deterministic end-to-end regression harness for post-MVP WarRoom operator workflow foundations.

## Test command

```bash
cd /Users/moldovancsaba/Projects/mvp-factory-control/apps/warroom
npm run e2e:warroom
```

## What the harness validates

The script (`apps/warroom/scripts/e2e/warroom-postmvp.e2e.js`) runs:

1. tool-call protocol + policy contract checks.
2. filesystem + shell execution path (including streamed shell output callback).
3. git workflow path (status, protected-branch guard, checkout, add, commit, push to local bare remote).
4. rollback cleanup verification for temporary rehearsal workspaces.

Output is emitted as structured JSON and command exits non-zero on failure.

## Safety posture

- test work is isolated to temporary OS directories.
- no secrets are required for baseline run.
- no destructive operations are performed on project workspace.

## Notes

- this harness is a local/CI-safe deterministic regression baseline.
- runtime GitHub PR publishing and runtime issue-evidence network posting remain separately validated through operational issue evidence in the launch lane (`#137`, `#138`).

## Latest run evidence

Latest verified run (local):
- run id: `warroom-e2e-2026-02-13T18:06:33.097Z`
- command: `npm run e2e:warroom`
- result: PASS
- stage highlights:
  - protocol: `policyRequiresApproval=true`, `highestRiskClass=CRITICAL`
  - shell stream events: `2`
  - git protected branch guard: `PROTECTED_BRANCH_DENIED`
  - rollback cleanup: `workspaceRemoved=true`, `gitRootRemoved=true`
