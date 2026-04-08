# Reply

This file describes **portfolio routing and boundaries** only. Executable behavior and code comments live in the product repository path below, not in `apps/mvp-factory-control`.

## Portfolio Role

- product repository managed through `mvp-factory-control`

## Local Repository

- `/Users/moldovancsaba/Projects/reply`

## Boundary

- `mvp-factory-control` owns the issue, board card, shared standards, and portfolio process.
- `reply` owns Reply implementation code and Reply-local docs.

## Work Routing

Keep work in `mvp-factory-control` when changing shared workflow or portfolio-wide rules.

Move work to `reply` when changing product behavior, product setup, or Reply-local docs.
