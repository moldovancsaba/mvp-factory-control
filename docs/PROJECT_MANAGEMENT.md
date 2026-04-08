# Project Management

`mvp-factory-control` is the portfolio delivery-management repository.

## Source Of Truth

Delivery truth lives in:

- GitHub issues in this repository
- the GitHub Project board

Board:

- [GitHub Project 1](https://github.com/users/moldovancsaba/projects/1)

## Delivery Contract

Every delivery task must have:

- an issue in this repository
- a project card on the board
- a `Product` value
- a `Status` value
- acceptance details sufficient for execution

## Core Fields

- `Status`
- `Agent`
- `Product`
- `Type`
- `Priority`

## Field Meaning

- `Status`: lifecycle stage on the board
- `Agent`: current owner or executor
- `Product`: target repository or managed system
- `Type`: class of work such as feature, bug, docs, refactor, or release
- `Priority`: urgency level for sequencing and response

## Suggested Status Flow

- `Backlog`
- `Ready`
- `In Progress`
- `Review`
- `Done`
- `Blocked`

## Rule Of Execution

Agents should not start implementation until the task is truly actionable.

That means:

- the issue is readable
- the product is identified
- the task belongs on the board
- the acceptance conditions are clear enough to execute

See [EXECUTABLE_PROMPT_PACKAGE.md](EXECUTABLE_PROMPT_PACKAGE.md) for the minimum issue-body structure.

## Dependency Blocking & Concurrency

The **Scrum Master Daemon** mathematically throttles concurrency and enforces dependencies to keep the board clean.
- **Dependencies**: In the issue description, write `Depends on: CHE-15, CHE-16` to mathematically hard-block early execution. The Scrum Master will pull the task from the agent until all dependencies are Done.
- **Concurrency**: Agents are allotted exactly `1` concurrent task. They cannot be overloaded.

## Background Allocation

Unassigned tasks placed in `Backlog` are automatically parsed by the orchestrator. They will be distributed to idle agents sequentially, determined first by Priority (`urgent` > `high` > `medium` > `low`) and second by oldest numeric Task ID.

## Relationship To Product Repositories

This repository manages the task.

The product repository usually contains the code change.

See [PROJECT_REPOSITORIES.md](PROJECT_REPOSITORIES.md).

## Evidence Contract

Issue updates should record:

- what changed
- where it changed
- how it was validated
- what remains or what is blocked

If implementation happened in a product repository, evidence here should still point back to the exact repository and validation result.

## Delivery Rules

- create work here first, then route it
- keep board state and issue state aligned
- do not let `Ready` mean “still being clarified”
- record blockers explicitly instead of hiding them in comments
- update shared docs here when the change affects portfolio-wide behavior

## Scripts

- `./scripts/mvp-factory-set-project-fields.sh`
- `./scripts/mvp-factory-ready-gate-audit.sh`
- `node ./scripts/mvp-factory-validate-prompt-package.js`
