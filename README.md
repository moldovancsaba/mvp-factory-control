# MVP Factory Control (v1.4.1-sovereign)

`mvp-factory-control` is the central portfolio management repository for the MVP Factory.

It is the control system for the portfolio. This is where we:
- manage delivery issues across projects
- maintain the GitHub Project board workflow
- define operating rules for agents and operators
- keep shared prompts, standards, and knowledge
- document how work moves between this control repository and the product repositories
- run internal control-plane tooling that supports portfolio execution

This repository is the control layer for the portfolio and the primary home for the **Local-First AI Factory**.

We use a decentralized, autonomous architecture to manage full-stack delivery with maximum privacy and reliability.

## Contributors and `main` history

`main` was reset from the canonical local workspace (April 2026). If you had an older clone, **do not merge** expecting continuity: fetch and `git reset --hard origin/main`, or **re-clone** the repository.

`main` is **branch-protected**: the `portability-gate` check must pass before merge, and **force-push is disabled**. To rewrite `main` again, a repo admin must temporarily change branch protection in GitHub settings.

## Start Here

- Wiki: [docs/WIKI.md](docs/WIKI.md)
- Developer and agent guide: [READMEDEV.md](READMEDEV.md) (includes **Source map** for every `apps/mvp-factory-control` module)
- Portfolio operating model: [docs/PROJECT_MANAGEMENT.md](docs/PROJECT_MANAGEMENT.md)
- Repository boundary map: [docs/PROJECT_REPOSITORIES.md](docs/PROJECT_REPOSITORIES.md)
- Command and environment policy: [docs/COMMAND_ACCESS_POLICY.md](docs/COMMAND_ACCESS_POLICY.md)
- Internal control app: [docs/INTERNAL_CONTROL_APP.md](docs/INTERNAL_CONTROL_APP.md)
- Board workflow: [docs/PROJECT_MANAGEMENT.md](docs/PROJECT_MANAGEMENT.md)
- Coding standards: [docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md)
- UI/UX standards: [docs/UI_UX_STANDARDS.md](docs/UI_UX_STANDARDS.md)

## Repository Mission

The repository has four responsibilities:

- portfolio governance: define shared delivery rules, standards, prompts, and documentation
- portfolio tracking: keep every delivery item visible as an issue and board item
- portfolio routing: direct implementation work into the correct product repository
- portfolio tooling: host the internal control app and scripts that support delivery operations

## 🚀 Quick Start (1-Step Install)

Ensure you have **Homebrew** installed, then run:

```bash
bash scripts/bootstrap.sh
```

> [!NOTE]
> This command will design your environment, pull AI models, and install the **Control.app** to your `/Applications` folder for Spotlight launching.

---

## 🏗️ Industrial Requirements

- **Apple Silicon (M1/M2/M3)**: Highly recommended for LLM performance.
- **macOS 13+**: For background service persistence.
- **Sibling Repos**: Clone `paperclip` next to this folder for full dashboard access.

## System Boundary

This repository owns:

- GitHub issues used as delivery records across the portfolio
- project-board structure, fields, and workflow rules
- shared prompts, agent operating guidance, and coordination doctrine
- shared coding and design standards
- shared portfolio knowledge in Markdown/wiki form
- scripts and internal tooling that help agents and operators manage the board consistently

This repository does not own:

- the primary implementation code for most products
- product-local implementation docs that only matter to one product
- product release notes that belong with a product repository
- product-specific setup that is only relevant inside one product repository

## Managed Projects

This repository centrally manages delivery for the following repositories:

- `amanoba` at `/Users/moldovancsaba/Projects/amanoba`
- `cardmass` at `/Users/moldovancsaba/Projects/cardmass`
- `hatori` at `/Users/moldovancsaba/Projects/hatori`
- `kormanyvalto` at `/Users/moldovancsaba/Projects/kormanyvalto`
- `launchmass` at `/Users/moldovancsaba/Projects/launchmass`
- `messmass` at `/Users/moldovancsaba/Projects/messmass`
- `narimato` at `/Users/moldovancsaba/Projects/narimato`
- `reply` at `/Users/moldovancsaba/Projects/reply`
- `sentinelsquad` at `/Users/moldovancsaba/Projects/sentinelsquad`
- `sso` at `/Users/moldovancsaba/Projects/sso`

Detailed project pages live under [`docs/projects/`](docs/projects).

## Board Source Of Truth

- Repo: [moldovancsaba/mvp-factory-control](https://github.com/moldovancsaba/mvp-factory-control)
- Board: [GitHub Project 1](https://github.com/users/moldovancsaba/projects/1)

The board is the operational source of truth for delivery state.

Each task should exist as:

- an issue in this repository
- a card on the board

## Operating Model

Use `mvp-factory-control` for:

- issue creation
- board state management
- cross-project standards
- agent prompts and operating rules
- portfolio knowledge

Use the product repository for:

- product implementation
- product-specific tests and builds
- product-local architecture and feature docs

Use the internal control app for:

- operator workflows
- agent execution support
- board-linked orchestration inside this repository

## Documentation Model

The repository uses a wiki-style Markdown system with explicit categories.

Core navigation:

- [docs/WIKI.md](docs/WIKI.md)
- [docs/PROJECT_MANAGEMENT.md](docs/PROJECT_MANAGEMENT.md)
- [docs/PROJECT_REPOSITORIES.md](docs/PROJECT_REPOSITORIES.md)
- [docs/BUILD_AND_RUN.md](docs/BUILD_AND_RUN.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/EVOLUTION.md](docs/EVOLUTION.md)
- [docs/GENERAL_KNOWLEDGE.md](docs/GENERAL_KNOWLEDGE.md)
- [docs/AGENT_PROMPTS.md](docs/AGENT_PROMPTS.md)
- [docs/COMMAND_ACCESS_POLICY.md](docs/COMMAND_ACCESS_POLICY.md)
- [docs/INTERNAL_CONTROL_APP.md](docs/INTERNAL_CONTROL_APP.md)

Shared standards:

- [docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md)
- [docs/UI_UX_STANDARDS.md](docs/UI_UX_STANDARDS.md)
- [docs/RULES.md](docs/RULES.md)

## Standard Agent Loop

Agents should:

1. read the issue and board card in this repository. Ensure it is moved from **Backlog (SOONER)** to **Todo (NEXT)** when it is actionable.
2. verify no dependencies are mathematically blocked by the **Scrum Master Orchestrator**.
3. identify the target project from the `Product` field.
4. open the corresponding product page under `docs/projects/`.
5. switch to the correct product repository for implementation.
6. return evidence and status updates to the issue here.
7. update shared docs here if a cross-project rule changed.

## Internal Structure

- [`docs/`](docs) stores portfolio governance, standards, prompts, and project navigation
- [`scripts/`](scripts) stores board and validation automation
- [`apps/mvp-factory-control`](apps/mvp-factory-control) stores the internal control app

## Scripts

Board/issue scripts:

- [scripts/mvp-factory-set-project-fields.sh](scripts/mvp-factory-set-project-fields.sh) — optional short `--status` aliases (`Backlog`, `Ready`, `Roadmap`, `In Progress`); see [docs/SETUP.md](docs/SETUP.md#board-status-shortcuts)
- [scripts/list-project-column.sh](scripts/list-project-column.sh) — print Status options or list items by status (exact strings for `gh` and other tools)
- [scripts/mvp-factory-ready-gate-audit.sh](scripts/mvp-factory-ready-gate-audit.sh)
- [scripts/mvp-factory-validate-prompt-package.js](scripts/mvp-factory-validate-prompt-package.js)

Internal control-plane scripts:

- [scripts/mvp-factory-control-docker-preflight.sh](scripts/mvp-factory-control-docker-preflight.sh)
- [scripts/mvp-factory-control-docker-bootstrap.sh](scripts/mvp-factory-control-docker-bootstrap.sh)
- [scripts/mvp-factory-control-docker-portability-gate.sh](scripts/mvp-factory-control-docker-portability-gate.sh)

## Internal Control Plane

The factory is managed by a unified control plane:

- **Next.js App**: Stored in [`apps/mvp-factory-control`](apps/mvp-factory-control) for board management.
- **Service Control**: Managed via **Control.app** in `/Applications` (macOS Menu Bar Launcher).
- **24/7 Availability**: Solidified by the **Sovereign Watchdog** (KeepAlive monitor).
- **Scrum Master Daemon**: Mathematical dependency checker and concurrency throttler ensuring exact delivery rules.
- **Local Network**: All services operate on standard `localhost` ports.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed implementation.
