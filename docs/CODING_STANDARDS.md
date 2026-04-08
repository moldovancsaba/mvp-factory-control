# Coding Standards

These are shared engineering standards for projects managed through `mvp-factory-control`.

## Core Principles

- no hardcoded business data when configuration or modeling is the right answer
- no hidden cross-repo coupling
- no undocumented workflow changes
- no duplicate implementations without a strong reason
- no stale shared docs after global behavior changes
- no checked-in runtime state or local operator artifacts
- no autonomous assumptions when requirements or architecture are unclear

## Configuration And Data

- prefer configuration over magic constants
- keep environment-specific values out of feature code
- prefer explicit schemas or typed structures where appropriate

## Dependencies

- keep dependencies minimal
- use maintained and supported versions only
- avoid deprecated, abandoned, or redundant packages
- do not add a new package unless it is clearly necessary and architecture-safe

## Quality

- validate before calling work complete
- keep blast radius small
- prefer reversible changes
- keep naming traceable and specific
- keep repository boundaries intact
- require builds to be warning-free, error-free, and deprecated-free

## Documentation Equals Code

- update documentation immediately after code changes
- keep documentation specific, verified, and maintainable
- never use placeholder text such as `TBD`
- treat undocumented behavior as incomplete delivery

## Module headers (`apps/mvp-factory-control`)

- Every `src/**/*.ts`, `src/**/*.tsx`, and worker `scripts/**/*.js` file carries a **file-level** `/** ... */` (or `#` / `"""` in Python) block at the top stating purpose, key dependencies, and non-obvious invariants.
- Prefer updating that block when behavior changes rather than scattering duplicate explanations across docs.
- The human-readable index of modules is [../READMEDEV.md](../READMEDEV.md) (**Source map**); keep it in sync when adding or renaming major modules.

## Per-line annotations (optional tooling; **not** a quality standard)

Scripts exist for historical/experimental use; **do not treat their output as good documentation.**

- `scripts/annotate-every-line.py` — inserts `//> …` above many lines in `.ts` / `.js` / `.mjs`, and partially in `.tsx` (JSX inside `return (…)` is skipped; TSX grammar cannot host a comment on every physical line without rewriting components).
- `scripts/strip-line-annotations.py` — removes `//>`, `//>>`, and `{/*> … */}` lines.
- `scripts/annotate-prisma-css-lines.py` — adds `//> P:` / `/*> C: … */` in schema and `globals.css`.

### Retrospective (2026-04) — **record for the future**

Bulk machine-generated per-line comments (**generic text repeated thousands of times**) did **not** improve maintainability: they add noise, worsen diffs and blame, train readers to ignore comments, and cannot cover TSX JSX trees anyway. **High-value documentation** remains: accurate **module-level** headers, real **why** comments at non-obvious spots, and **indexed docs** (READMEDEV source map, BUILD_AND_RUN env reference). Prefer that over regenerating `//>` churn.

If the team wants a lean codebase, run `strip-line-annotations.py` (and remove Prisma/CSS line prefixes if desired), then rely on module headers and real docs only.
