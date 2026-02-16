# Executable Prompt Package (v1)

Every issue that is moved to `Ready` (and every issue executed from WarRoom) must contain a complete executable prompt package.

If the package is incomplete:
- card must stay in `Backlog` (or be moved back from `Ready`/`In Progress`)
- WarRoom enqueue must be blocked

## Required sections

Use these headings in the issue body:

```md
## Objective
...

## Execution Prompt
...

## Scope / Non-goals
...

## Constraints
...

## Acceptance Checks
- [ ] ...
- [ ] ...

## Delivery Artifact
...
```

`Scope / Non-goals` can also be split into two headings:
- `## Scope`
- `## Non-goals`

## Quality bar

- `Objective`: specific and outcome-oriented.
- `Execution Prompt`: direct instructions an agent can run without guessing.
- `Constraints`: explicit boundaries (tech, policy, safety, infra, etc.).
- `Acceptance Checks`: checklist/bullets with verifiable outcomes.
- `Delivery Artifact`: exact expected output (PR, file path, report, etc.).

## Placeholder ban

These invalidate the package:
- `TBD`, `TODO`, `...`, `placeholder`, `N/A` in required sections
- empty required sections

## Example

```md
## Objective
Ensure WarRoom blocks queue execution when issue prompt package is incomplete.

## Execution Prompt
Implement issue-level prompt-package validation in WarRoom issue actions before enqueue.
If invalid, return a blocking error message with missing sections and keep task unqueued.
Add UI visibility on issue page.

## Scope / Non-goals
Scope: issue page + issue actions + prompt validator utility.
Non-goals: global chat mention flow, non-issue task types.

## Constraints
Do not expose secrets. Preserve existing readiness and runtime safety gates. Keep changes additive.

## Acceptance Checks
- [ ] Enqueue from issue page fails when required sections are missing.
- [ ] Error lists missing sections.
- [ ] Enqueue succeeds after package is complete.

## Delivery Artifact
PR with changed files under `apps/warroom/src/app/issues` and `apps/warroom/src/lib`, plus build pass output.
```
