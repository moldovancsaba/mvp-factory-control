# MVP Factory Control

**Agent control** — this repository holds **issues** that drive the [MVP Factory Board](https://github.com/users/moldovancsaba/projects/1). Multiple agents and products use the same board; each issue is a card with fields: Status, Agent, Product, Type, Priority.

**All scripts and rules live in this repo.** Follow [docs/RULES.md](docs/RULES.md) to work on the project; use [docs/SETUP.md](docs/SETUP.md) once for access.

---

## What’s in this repository

| Path | Purpose |
|------|--------|
| **[docs/RULES.md](docs/RULES.md)** | **Rules you must follow** — create issues only, use templates, Ready = start work, and mandatory board sync after every action step (including status/evidence updates). Read this before working on the board. |
| **[docs/EXECUTABLE_PROMPT_PACKAGE.md](docs/EXECUTABLE_PROMPT_PACKAGE.md)** | **Ready gate spec** — required issue-body package format for executable tasks (Objective, Execution Prompt, Scope/Non-goals, Constraints, Acceptance Checks, Delivery Artifact). |
| **[docs/SETUP.md](docs/SETUP.md)** | **One-time access** — grant GitHub CLI project scope so scripts can read/update the board (`gh auth refresh -h github.com -s read:project,project`). |
| **[docs/agent-operating-document-amanoba.md](docs/agent-operating-document-amanoba.md)** | **Agent operating document — Amanoba project.** Project-related agentic rules for the Amanoba product (repo: amanoba); how Amanoba ties into the board; cold start, loopback, handoff. Stored here as part of the unified knowledge center. |
| **[docs/agent-operating-document-messmass.md](docs/agent-operating-document-messmass.md)** | **Agent operating document — MessMass project.** Project-related agentic rules for the MessMass product (repo: messmass); how MessMass ties into the board; cold start, loopback, handoff. Stored here as part of the unified knowledge center. |
| **[scripts/mvp-factory-set-project-fields.sh](scripts/mvp-factory-set-project-fields.sh)** | Script to set board fields (Status, Agent, Product, Type, Priority) for an issue. Reads current state first; only updates fields you pass. Requires `gh` + `jq` and completed [SETUP.md](docs/SETUP.md). |
| **[scripts/mvp-factory-validate-prompt-package.js](scripts/mvp-factory-validate-prompt-package.js)** | Validates required Executable Prompt Package sections in an issue body (used by Ready gate and audits). |
| **[scripts/mvp-factory-ready-gate-audit.sh](scripts/mvp-factory-ready-gate-audit.sh)** | Audits/enforces Ready gate for cards in `Ready` / `In Progress`; can auto-move invalid cards to `Backlog` with comments. |
| **[scripts/warroom-docker-preflight.sh](scripts/warroom-docker-preflight.sh)** | WarRoom Docker portability preflight (CLI/daemon/compose/env/port checks) with deterministic PASS/FAIL and remediation output. |
| **[scripts/warroom-docker-bootstrap.sh](scripts/warroom-docker-bootstrap.sh)** | One-command WarRoom Docker bootstrap: preflight, DB start, migration deploy, app start, and health verification. |
| **[scripts/warroom-docker-portability-gate.sh](scripts/warroom-docker-portability-gate.sh)** | Automated Docker portability gate script (preflight + compose parse + startup + healthy/unhealthy assertions + remediation diagnostics). |
| **[scripts/mvp-factory-defaults.env](scripts/mvp-factory-defaults.env)** | Default values for the script (used when a field has no override and no current value on the board). Override with flags or env. |
| **[.github/ISSUE_TEMPLATE/](.github/ISSUE_TEMPLATE/)** | Issue templates (Feature, Bug, Docs, Refactor, Release). Use them when creating issues. |
| **[docs/SYNC.md](docs/SYNC.md)** | **Keeping board and repo in sync** — new issues auto-added to the board (Action); one-time secret `MVP_PROJECT_TOKEN`; how to keep both up to date. |
| **[.github/workflows/add-issue-to-project.yml](.github/workflows/add-issue-to-project.yml)** | Action: when an issue is opened, add it to the board. Requires repo secret `MVP_PROJECT_TOKEN` (PAT with project scope). |
| **[.github/workflows/enforce-ready-prompt-gate.yml](.github/workflows/enforce-ready-prompt-gate.yml)** | Scheduled/manual gate enforcement: checks `Ready` / `In Progress` cards and demotes invalid prompt packages to `Backlog`. |
| **[.github/workflows/warroom-docker-portability-gate.yml](.github/workflows/warroom-docker-portability-gate.yml)** | CI portability gate for WarRoom Docker path: runs compose parse/startup/health checks and fails with remediation diagnostics on portability regressions. |
| **[docs/CENTRALIZATION.md](docs/CENTRALIZATION.md)** | **What else to care about** when centralizing: discovery/index, adding a new product, agent-doc template, avoiding drift, secrets, onboarding, naming. Checklist for the process. |
| **[docs/MIGRATION_ROADMAP_TASKLIST.md](docs/MIGRATION_ROADMAP_TASKLIST.md)** | **Migration:** ROADMAP.md / TASKLIST.md → board. Roadmap column = vision; Backlog = not broken down; Ready = actionable. Script: `scripts/migrate-roadmap-tasklist-to-project.sh`. |
| **[scripts/migrate-roadmap-tasklist-to-project.sh](scripts/migrate-roadmap-tasklist-to-project.sh)** | One-time migration: create issues from ROADMAP + TASKLIST, set Status = Roadmap / Backlog / Ready. Use `--dry-run` first. |
| **[docs/PROMPT_RELOCATE_PROJECT_TO_BOARD.md](docs/PROMPT_RELOCATE_PROJECT_TO_BOARD.md)** | **Prompt to give to any agent** to relocate another product’s project management into this repo and the board (replace &lt;PRODUCT&gt; and &lt;PRODUCT_REPO&gt;). |
| **[docs/WARROOM_WHY_AND_HOW.md](docs/WARROOM_WHY_AND_HOW.md)** | **War Room corporate WHY/HOW** — rationale, operating method, and strategic initiative framing. |
| **[docs/WARROOM_MANIFESTO.md](docs/WARROOM_MANIFESTO.md)** | **War Room manifesto** — foundational operating principles and Alpha/Beta control model. |
| **[docs/WARROOM_DELIVERY_STORY.md](docs/WARROOM_DELIVERY_STORY.md)** | **War Room delivery story** — milestone target, operating model, and acceptance signals. |
| **[docs/WARROOM_MVP_SPINE_AND_BACKLOG.md](docs/WARROOM_MVP_SPINE_AND_BACKLOG.md)** | **War Room spine/backlog contract** — hard invariants, lane rules, and future initiative map. |
| **[docs/WARROOM_HANDOVER.md](docs/WARROOM_HANDOVER.md)** | **Operational continuation pack** — current runtime truth, gates, runbook, and continuation prompt. |
| **[docs/WARROOM_STATUS_BRAINDUMP.md](docs/WARROOM_STATUS_BRAINDUMP.md)** | **Concise status digest** — current baseline, open gaps, and live command pack. |
| **[docs/WARROOM_DOCKER_PORTABILITY_HEALTH_REPORT.md](docs/WARROOM_DOCKER_PORTABILITY_HEALTH_REPORT.md)** | **Docker portability health report** — dependency evidence links, operator health rubric, and current assessed portability level. |
| **[docs/DOCUMENT_SYSTEM_AUDIT.md](docs/DOCUMENT_SYSTEM_AUDIT.md)** | **Documentation audit record** — ownership map, duplication cleanup, and storage correctness checks. |

---

## Where to see the board

- **Project board:** [GitHub Project 1 — MVP Factory Board](https://github.com/users/moldovancsaba/projects/1)
- **This repo’s issues:** [mvp-factory-control Issues](https://github.com/moldovancsaba/mvp-factory-control/issues)

---

## Board fields (every card)

| Field       | Purpose           | Example values |
|------------|-------------------|----------------|
| **Status** | Workflow state     | `Roadmap` \| `Backlog` → `Ready` → `In Progress` → `Review` → `Done` |
| **Agent**  | Who does the work | `Gwen`, `Chappie`, `Tribeca` |
| **Product**| Which product/repo | `amanoba`, `doneisbetter`, `messmass`, etc. |
| **Type**   | Kind of work      | `Feature`, `Bug`, `Refactor`, `Docs`, `Audit`, `Release`, `Plan` |
| **Priority** | Urgency         | `P0`, `P1`, `P2`, `P3` |

Work starts only when **Status** is **Ready** and the issue body has a valid Executable Prompt Package: [docs/EXECUTABLE_PROMPT_PACKAGE.md](docs/EXECUTABLE_PROMPT_PACKAGE.md).

Mandatory execution discipline:
- after each meaningful implementation step, update board fields immediately.
- after validation, post issue evidence and move status to `Done` in the same work window.
- if board status is not updated, work is not considered complete.

---

## Onboarding (new agents)

Clone this repo (and the product repo you work on, e.g. amanoba). Do [SETUP.md](docs/SETUP.md) once, then read [RULES.md](docs/RULES.md) and the **agent doc for your product** (e.g. [agent-operating-document-amanoba.md](docs/agent-operating-document-amanoba.md)).

---

## Quick start for agents

1. **Read the rules:** [docs/RULES.md](docs/RULES.md)
2. **One-time access (IDE or any terminal):** [docs/SETUP.md](docs/SETUP.md) — run `gh auth refresh -h github.com -s read:project,project` and complete the browser step.
3. **Set yourself on a card:**  
   `./scripts/mvp-factory-set-project-fields.sh ISSUE_NUMBER --agent YourName`  
   (e.g. `./scripts/mvp-factory-set-project-fields.sh 2 --agent Gwen`)
4. **Change only one field** (others stay as on the board):  
   `./scripts/mvp-factory-set-project-fields.sh 2 --priority P0`
5. **Or use the GitHub UI:** Open the [board](https://github.com/users/moldovancsaba/projects/1), open the card, set **Agent** (and Status, Priority, etc.) there.

---

## Script usage (from this repo)

```bash
# Set yourself as agent for issue #2
./scripts/mvp-factory-set-project-fields.sh 2 --agent Tribeca

# Only change priority (Agent, Status, Product, Type stay as on the board)
./scripts/mvp-factory-set-project-fields.sh 2 --priority P2

# Set agent and status
./scripts/mvp-factory-set-project-fields.sh 2 --agent Chappie --status Ready
```

**Behaviour:** The script reads the **current** board state first. Only the fields you pass (flags or env) are updated; **all other fields are left unchanged** so multiple agents can work without overwriting each other.

**Env overrides (optional):**  
`MVP_AGENT`, `MVP_STATUS`, `MVP_PRIORITY`, `MVP_PRODUCT`, `MVP_TYPE` — if set, they act as overrides like the flags.

---

## War Room (webapp)

This repo also contains a local-first **War Room** webapp:

- App: `apps/warroom`
- App image build file: `apps/warroom/Dockerfile`
- Setup: `docs/WARROOM_SETUP.md`

The War Room reads/writes the **GitHub Project 1** board and stores chat/transcripts in Postgres.

For WarRoom execution planning:
- Canonical roadmap/backlog/tasklist state is GitHub Issues + Project fields (`Product=WarRoom`).
- Markdown docs capture doctrine/context and should not be used as checklist state.

---

## Summary for agents

| I want to…              | Do this |
|-------------------------|--------|
| Know the rules          | Read [docs/RULES.md](docs/RULES.md) |
| Get access (IDE/CLI)    | Do once: [docs/SETUP.md](docs/SETUP.md) — `gh auth refresh -h github.com -s read:project,project` |
| See the board           | Open [GitHub Project 1](https://github.com/users/moldovancsaba/projects/1) |
| Set myself on a card    | UI: open card → set **Agent**. Or: `./scripts/mvp-factory-set-project-fields.sh ISSUE_NUM --agent MyName` |
| Change only one field   | Run script with only that flag (e.g. `--priority P2`); others stay as on the board |
| Know when to start work | Start only when the card is in **Ready** |
| Create a new task       | Create an issue in this repo (use a template under [.github/ISSUE_TEMPLATE/](.github/ISSUE_TEMPLATE/)), add to board, set Agent/Product/Status |

---

**Repo:** [moldovancsaba/mvp-factory-control](https://github.com/moldovancsaba/mvp-factory-control)  
**Board:** [MVP Factory Board (Project 1)](https://github.com/users/moldovancsaba/projects/1)

To keep the **board and repo in sync** (new issues → board automatically), see [docs/SYNC.md](docs/SYNC.md) and set the **MVP_PROJECT_TOKEN** repository secret once.
