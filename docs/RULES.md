# Rules

These are the global operating rules for the MVP Factory portfolio.

**Code truth:** Portfolio automation and the internal app are implemented under this repo’s `apps/` and `scripts/` trees; module headers describe enforceable behavior.

## Delivery Rules

- create and manage delivery issues in `mvp-factory-control`
- keep issue state and board state aligned
- use the `Product` field to identify the implementation repository
- do not implement unrelated product code in this repository
- keep shared standards here, not hidden inside one product repo
- keep repository naming consistent: this repository is `mvp-factory-control`
- use the operator's authenticated GitHub access when repository inspection, commit, or push is required
- execute autonomously on implementation, but never autonomously on assumptions

## Engineering Rules

- no hardcode when configuration or modeling is the correct solution
- no baked-in styles that block reuse or theming
- no stale shared docs after global process changes
- no committing local runtime state, logs, or generated control-app output
- no warning-producing, error-producing, or deprecated build output in delivered work
- no unnecessary dependencies, helpers, or framework drift

## Documentation Rules

- shared process docs belong here
- product-local implementation docs belong in the product repository
- add durable shared docs to [WIKI.md](WIKI.md)
- documentation must be updated in the same work window as the code change
- no placeholders, filler text, or unverified statements
- if the code and docs do not match, the task is not complete
