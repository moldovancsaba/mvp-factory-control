# Executable Prompt Package

This is the minimum structure a delivery issue should have before it is considered truly executable.

Recommended sections for a complete issue description:

- Objective
- Product (portfolio routing / context for operators; **not** validated by the internal app’s `validateExecutablePromptPackage` — see `apps/mvp-factory-control/src/lib/executable-prompt.ts`)
- Execution Prompt
- Scope / Non-goals
- Constraints
- Acceptance Checks
- Delivery Artifact

**App-enforced minimum** (what the control app checks on issues): Objective, Execution Prompt, Scope / Non-goals (or separate Scope + Non-goals), Constraints, Acceptance Checks (with bullet/checklist lines), Delivery Artifact.

## Minimum Template

```md
## Objective
...

## Product
...

## Execution Prompt
...

## Scope / Non-goals
...

## Constraints
...

## Acceptance Checks
- [ ] ...

## Delivery Artifact
...
```
