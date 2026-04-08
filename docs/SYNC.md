# Sync

This document explains how issues, board state, product repos, and shared docs stay in sync.

GitHub integration code: `apps/mvp-factory-control/src/lib/github.ts` (see file header for token env vars and GraphQL usage).

## Sync Model

- issues live in `mvp-factory-control`
- board workflow lives in GitHub Project
- implementation usually lives in a product repository
- shared standards and prompts live in `mvp-factory-control`

## Required Sync Points

- when work starts
- when status changes
- when a blocker appears
- when evidence is added
- when shared process or standards change

## Sync Rule

If implementation happened in a product repository, update both places:

- the product repository with the code and product-local documentation
- `mvp-factory-control` with issue evidence, board status, and any shared-rule updates
