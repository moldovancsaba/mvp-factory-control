# Internal Control App

This document defines the role of the internal control app stored in [`apps/mvp-factory-control`](../apps/mvp-factory-control).

## Role

The app is internal control-plane tooling for `mvp-factory-control`.

Its purpose is to support:

- board-linked execution workflows
- operator visibility
- agent orchestration support
- command and environment governance

## Boundary

The app belongs to this repository.

It is not:

- a separate portfolio product
- the identity of the repository
- a destination for unrelated product feature work

## Repository Rule

The repository name is `mvp-factory-control`.

The app path is `apps/mvp-factory-control`.

External documentation, README copy, workflow labels, and operator-facing language should frame it as the internal control app for `mvp-factory-control`.

## Local Runtime

Typical developer paths (use whichever matches the machine):

- `/Users/moldovancsaba/Projects/mvp-factory-control/apps/mvp-factory-control`
- `/Users/Shared/Projects/mvp-factory-control/apps/mvp-factory-control` (shared Mac layout; see [TRANSFER_TO_SHARED_MAC.md](TRANSFER_TO_SHARED_MAC.md))

The app may use local runtime state under `.mvp-factory-control`, but runtime state, logs, and shell-session artifacts should not be committed to git.

## Naming Policy

Use `mvp-factory-control` or "internal control app" in:

- repository-facing documentation
- workflow names
- operator-facing descriptions
- package metadata

Use `MVP_FACTORY_CONTROL_*` for environment variables and other identifier-safe namespaces where hyphens are not valid syntax.

## Product Relationship

The app may help agents operate across product repositories, but it does not replace those repositories.

Use the app to coordinate work.

Use product repositories to implement product code.

## Related Docs

- [PROJECT_MANAGEMENT.md](PROJECT_MANAGEMENT.md)
- [PROJECT_REPOSITORIES.md](PROJECT_REPOSITORIES.md)
- [COMMAND_ACCESS_POLICY.md](COMMAND_ACCESS_POLICY.md)
- [BUILD_AND_RUN.md](BUILD_AND_RUN.md)
