# Amanoba

This file describes **portfolio routing and boundaries** only. Executable behavior and code comments live in the product repository path below, not in `apps/mvp-factory-control`.

## Portfolio Role

- product repository managed through `mvp-factory-control`

## Local Repository

- `/Users/moldovancsaba/Projects/amanoba`

## Boundary

- `mvp-factory-control` owns the issue, board card, shared standards, and portfolio process.
- `amanoba` owns Amanoba implementation code and Amanoba-local docs.

## Work Routing

Keep work in `mvp-factory-control` when changing:

- issue tracking
- board state
- shared prompts
- shared standards

Move work to `amanoba` when changing:

- application behavior
- product-specific setup
- product-specific documentation
