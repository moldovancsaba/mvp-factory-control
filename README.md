# MVP Factory Control

**Agent control** — this repository holds **issues** that drive the [MVP Factory Board](https://github.com/users/moldovancsaba/projects/1). Multiple agents and products use the same board; each issue is a card with fields: Status, Agent, Product, Type, Priority.

**All scripts and rules live in this repo.** Follow [docs/RULES.md](docs/RULES.md) to work on the project; use [docs/SETUP.md](docs/SETUP.md) once for access.

---

## What’s in this repository

| Path | Purpose |
|------|--------|
| **[docs/RULES.md](docs/RULES.md)** | **Rules you must follow** — create issues only, use templates, Ready = start work, set Agent/Product, no overwrite. Read this before working on the board. |
| **[docs/SETUP.md](docs/SETUP.md)** | **One-time access** — grant GitHub CLI project scope so scripts can read/update the board (`gh auth refresh -h github.com -s read:project,project`). |
| **[docs/agent-operating-document-amanoba.md](docs/agent-operating-document-amanoba.md)** | **Agent operating document — Amanoba project.** Project-related agentic rules for the Amanoba product (repo: amanoba); how Amanoba ties into the board; cold start, loopback, handoff. Stored here as part of the unified knowledge center. |
| **[scripts/mvp-factory-set-project-fields.sh](scripts/mvp-factory-set-project-fields.sh)** | Script to set board fields (Status, Agent, Product, Type, Priority) for an issue. Reads current state first; only updates fields you pass. Requires `gh` + `jq` and completed [SETUP.md](docs/SETUP.md). |
| **[scripts/mvp-factory-defaults.env](scripts/mvp-factory-defaults.env)** | Default values for the script (used when a field has no override and no current value on the board). Override with flags or env. |
| **[.github/ISSUE_TEMPLATE/](.github/ISSUE_TEMPLATE/)** | Issue templates (Feature, Bug, Docs, Refactor, Release). Use them when creating issues. |
| **[docs/SYNC.md](docs/SYNC.md)** | **Keeping board and repo in sync** — new issues auto-added to the board (Action); one-time secret `MVP_PROJECT_TOKEN`; how to keep both up to date. |
| **[.github/workflows/add-issue-to-project.yml](.github/workflows/add-issue-to-project.yml)** | Action: when an issue is opened, add it to the board. Requires repo secret `MVP_PROJECT_TOKEN` (PAT with project scope). |

---

## Where to see the board

- **Project board:** [GitHub Project 1 — MVP Factory Board](https://github.com/users/moldovancsaba/projects/1)
- **This repo’s issues:** [mvp-factory-control Issues](https://github.com/moldovancsaba/mvp-factory-control/issues)

---

## Board fields (every card)

| Field       | Purpose           | Example values |
|------------|-------------------|----------------|
| **Status** | Workflow state     | `Backlog` → `Ready` → `In Progress` → `Review` → `Done` |
| **Agent**  | Who does the work | `Tribeca`, `Katja`, `Becca`, `Gwen`, `Chappie` |
| **Product**| Which product/repo | `amanoba`, `doneisbetter`, `messmass`, etc. |
| **Type**   | Kind of work      | `Feature`, `Bug`, `Refactor`, `Docs`, `Audit`, `Release`, `Plan` |
| **Priority** | Urgency         | `P0`, `P1`, `P2`, `P3` |

Work starts only when **Status** is **Ready**.

---

## Quick start for agents

1. **Read the rules:** [docs/RULES.md](docs/RULES.md)
2. **One-time access (IDE or any terminal):** [docs/SETUP.md](docs/SETUP.md) — run `gh auth refresh -h github.com -s read:project,project` and complete the browser step.
3. **Set yourself on a card:**  
   `./scripts/mvp-factory-set-project-fields.sh ISSUE_NUMBER --agent YourName`  
   (e.g. `./scripts/mvp-factory-set-project-fields.sh 2 --agent Becca`)
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
./scripts/mvp-factory-set-project-fields.sh 2 --agent Katja --status Ready
```

**Behaviour:** The script reads the **current** board state first. Only the fields you pass (flags or env) are updated; **all other fields are left unchanged** so multiple agents can work without overwriting each other.

**Env overrides (optional):**  
`MVP_AGENT`, `MVP_STATUS`, `MVP_PRIORITY`, `MVP_PRODUCT`, `MVP_TYPE` — if set, they act as overrides like the flags.

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
