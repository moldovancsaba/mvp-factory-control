# Alpha Handover Artifact v1

Version: `v1`
Status: active
Scope: WarRoom Alpha context transfer artifacts

## Canonical Rules

- This schema is deterministic and human-readable.
- Every section below is required.
- Missing sections/fields fail validation.
- The artifact must include concrete project/context metadata and a continuation prompt reference.

## Required Section Schema

Use these exact section headers in all Alpha handover artifacts:

1. `# Alpha Handover Artifact v1`
2. `## 1) Active Context Metadata`
3. `## 2) Objective and Scope`
4. `## 3) Completed Since Last Window`
5. `## 4) Open Risks / Blockers`
6. `## 5) Next Actions (Ordered)`
7. `## 6) Continuation Prompt`
8. `## 7) Evidence and Links`

The metadata section must include these exact field labels:

- `- Project:`
- `- Active Window ID:`
- `- Alpha Owner:`
- `- Context Usage:`
- `- Continuation Prompt Ref:`

## Example Artifact (Valid)

```md
# Alpha Handover Artifact v1

## 1) Active Context Metadata
- Project: WarRoom
- Active Window ID: cm5alpha0001xyz
- Alpha Owner: @Gwen
- Context Usage: 72%
- Continuation Prompt Ref: docs/WARROOM_STATUS_BRAINDUMP.md#continuation-packet

## 2) Objective and Scope
- Objective: Enforce handover package spec + validator in package acceptance flow.
- Scope boundaries: validation only; no archival system.

## 3) Completed Since Last Window
- Added canonical handover spec doc (`docs/WARROOM_ALPHA_HANDOVER_SPEC_V1.md`).
- Added validator for required sections/metadata and continuation-prompt linkage.
- Integrated validation into package acceptance workflow.

## 4) Open Risks / Blockers
- Existing legacy handover refs may fail until migrated to v1 schema.

## 5) Next Actions (Ordered)
1. Update legacy handover docs to this v1 schema.
2. Add optional auto-template generation for operators.

## 6) Continuation Prompt
Continue work in /Users/moldovancsaba/Projects/mvp-factory-control.
Read first:
1) docs/WARROOM_HANDOVER.md
2) docs/WARROOM_STATUS_BRAINDUMP.md
3) docs/WARROOM_MVP_SPINE_AND_BACKLOG.md

## 7) Evidence and Links
- Validation build: `cd apps/warroom && npm run build`
- Issue: https://github.com/moldovancsaba/mvp-factory-control/issues/95
```
