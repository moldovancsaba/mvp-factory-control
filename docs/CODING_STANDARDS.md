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

## Per-line annotations (machine-maintained)

- `scripts/annotate-every-line.py` inserts `//> …` above **every** non-blank, non-comment line in `.ts`, `.js`, `.mjs`, and in `.tsx` **outside** `return ( … )` regions that contain JSX. Inserting a comment between arbitrary JSX lines is not valid ECMAScript/TSX, so JSX tree bodies are intentionally skipped after the first `<` / `{/*` / fragment inside such a return.
- `scripts/strip-line-annotations.py` removes `//>`, `//>>`, and legacy `{/*> … */}` lines for regeneration.
- `scripts/annotate-prisma-css-lines.py` adds `//> P:` lines in `prisma/schema.prisma` and `/*> C: … */` lines in `src/app/globals.css`.
- Regenerate after large edits: run `strip` then `annotate-every-line` then `annotate-prisma-css-lines`, then `npm run build` and `npx prisma validate`.
