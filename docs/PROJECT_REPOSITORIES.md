# Project Repositories

This document maps the central control repository to the individual product repositories.

**Internal app:** Source layout for `apps/mvp-factory-control` is indexed in [READMEDEV.md](../READMEDEV.md) (*Source map*). Product repos listed below own their own code comments.

## Central Repository

`mvp-factory-control` is the central repository for:

- board and issue management
- shared prompts
- shared standards
- shared portfolio knowledge
- agent operating rules
- internal control-plane tooling that supports portfolio operations

## Product Repositories

The following product repositories are managed through this central repo:

- `amanoba`: `/Users/moldovancsaba/Projects/amanoba`
- `cardmass`: `/Users/moldovancsaba/Projects/cardmass`
- `hatori`: `/Users/moldovancsaba/Projects/hatori`
- `kormanyvalto`: `/Users/moldovancsaba/Projects/kormanyvalto`
- `launchmass`: `/Users/moldovancsaba/Projects/launchmass`
- `messmass`: `/Users/moldovancsaba/Projects/messmass`
- `narimato`: `/Users/moldovancsaba/Projects/narimato`
- `reply`: `/Users/moldovancsaba/Projects/reply`
- `sentinelsquad`: `/Users/moldovancsaba/Projects/sentinelsquad`
- `sso`: `/Users/moldovancsaba/Projects/sso`

Each product has a dedicated page under [`docs/projects/`](projects).

## Decision Rule

If the work is about:

- delivery workflow
- issue management
- board process
- shared prompts
- portfolio-wide standards
- cross-project knowledge

then it belongs in `mvp-factory-control`.

If the work is about:

- product code
- product features
- product-local architecture
- product-specific setup
- product-specific tests

then it belongs in the relevant product repository.

## Routing Rule

Start in `mvp-factory-control`.

Stay in `mvp-factory-control` if the work concerns:

- shared governance
- board operations
- issue quality
- prompts, standards, or global knowledge
- internal control-plane tooling

Move to a product repository if the work concerns:

- product UI or product API behavior
- product data modeling
- product build or deployment logic
- product-only documentation

## Internal App Boundary

`apps/mvp-factory-control` is internal control-plane code that belongs to `mvp-factory-control`.

It is allowed to:

- support agent execution flows
- support board-linked workflows
- support operators working across the portfolio

It should not be treated as:

- a separate portfolio product
- a reason to move product implementation into this repository

## Agent Workflow

1. read the issue in `mvp-factory-control`
2. confirm the `Product` field
3. read the matching product page under `docs/projects/`
4. switch to the target product repository for implementation
5. return here for evidence and board updates
