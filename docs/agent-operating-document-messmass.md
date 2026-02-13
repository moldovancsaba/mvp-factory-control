# Agent Operating Document — MessMass Project

**Product**: MessMass (reporting + analytics platform)  
**Product repo**: [moldovancsaba/messmass](https://github.com/moldovancsaba/messmass)  
**This doc**: Stored in the **mvp-factory-control** unified knowledge center. It describes how agents work on the **MessMass** product and how MessMass ties into the [MVP Factory Board](https://github.com/users/moldovancsaba/projects/1).  
**Roles**: Sultan = Product Owner; Agent = AI Developer  
**Last updated**: 2026-02-13 (board discipline, prompt-package gate, and documentation audit refresh).

---

## Where this document lives (unified knowledge center)

This file lives in **[moldovancsaba/mvp-factory-control](https://github.com/moldovancsaba/mvp-factory-control)** so all project-related agentic docs are in one place. When working on **MessMass** (code in the messmass repo), use this doc for agent rules and for how MessMass connects to the board.

- **Board and project rules**: [RULES.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/RULES.md), [SETUP.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/SETUP.md), [SYNC.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/SYNC.md).
- **Script to set board fields**: [scripts/mvp-factory-set-project-fields.sh](https://github.com/moldovancsaba/mvp-factory-control/blob/main/scripts/mvp-factory-set-project-fields.sh) (in this repo).
- **MessMass code and ops docs**: In the **messmass** repo — see “Where documents are (for agents)” below for exact paths and URLs.

---

## Where documents are (for agents)

Use these so agents can open the right file in the IDE or from the repo.

**mvp-factory-control (this repo):**

| Doc | GitHub URL | Local path (when cloned) |
|-----|------------|---------------------------|
| RULES | https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/RULES.md | `mvp-factory-control/docs/RULES.md` (e.g. `Projects/mvp-factory-control/docs/RULES.md`) |
| SETUP | https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/SETUP.md | `mvp-factory-control/docs/SETUP.md` |
| SYNC | https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/SYNC.md | `mvp-factory-control/docs/SYNC.md` |
| Script | https://github.com/moldovancsaba/mvp-factory-control/blob/main/scripts/mvp-factory-set-project-fields.sh | `mvp-factory-control/scripts/mvp-factory-set-project-fields.sh` |

**messmass (product repo):**

| Doc | GitHub URL | Local path (when cloned) |
|-----|------------|---------------------------|
| operations-action-plan | https://github.com/moldovancsaba/messmass/blob/main/docs/operations/operations-action-plan.md | `messmass/docs/operations/operations-action-plan.md` |
| operations-roadmap | https://github.com/moldovancsaba/messmass/blob/main/docs/operations/operations-roadmap.md | `messmass/docs/operations/operations-roadmap.md` |
| operations-release-notes | https://github.com/moldovancsaba/messmass/blob/main/docs/operations/operations-release-notes.md | `messmass/docs/operations/operations-release-notes.md` |
| operations-learnings | https://github.com/moldovancsaba/messmass/blob/main/docs/operations/operations-learnings.md | `messmass/docs/operations/operations-learnings.md` |
| architecture | https://github.com/moldovancsaba/messmass/blob/main/docs/architecture.md | `messmass/docs/architecture.md` |
| docs index | https://github.com/moldovancsaba/messmass/blob/main/docs/index.md | `messmass/docs/index.md` |
| brain dump | https://github.com/moldovancsaba/messmass/blob/main/docs/messmass-codex-brain-dump.md | `messmass/docs/messmass-codex-brain-dump.md` |

If your workspace has both repos under a common parent (e.g. `Projects/`), full paths are: **`<workspace>/messmass/docs/<file>`** and **`<workspace>/mvp-factory-control/docs/<file>`**.

---

# Reminder — Use This When Your Context Is Reset

**What this document is:** The single source of truth for agent development on the **MessMass** product. If you have no memory of prior work, read this block and “How to Start” / “How to Come Back” first.

**Rules at a glance:**
- **Rollback plan** required for every delivery (baseline + exact steps + verification). No exceptions.
- **Documentation = code:** Update docs with every change. No placeholders, no TBD.
- **Single-place rule:** ROADMAP = vision only. TASKLIST/action plan = open tasks only. RELEASE_NOTES = completed only. Do not duplicate tasks across the three.
- **Project board (MVP Factory):** Work is tracked as issues in **mvp-factory-control** and as cards on the [MVP Factory Board](https://github.com/users/moldovancsaba/projects/1). Create issues only; use templates; work starts when the card is in **Ready**. Set **Agent**, **Product** (messmass), **Status**, **Priority** via [RULES.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/RULES.md) and the [script](https://github.com/moldovancsaba/mvp-factory-control/blob/main/scripts/mvp-factory-set-project-fields.sh).

---

# How to Start (Cold Start) — MessMass

When **starting fresh** on MessMass (new session, new task):

1. **In the messmass repo:** Read **messmass-codex-brain-dump.md** (current job, where we left off) — [GitHub](https://github.com/moldovancsaba/messmass/blob/main/docs/messmass-codex-brain-dump.md), local: `messmass/docs/messmass-codex-brain-dump.md`.
2. **Read this document** (Reminder, “How to come back”, “Ground Zero”).
3. **Next task:** Check the [MVP Factory Board](https://github.com/users/moldovancsaba/projects/1) for cards with **Product = messmass** and **Status = Ready**. Roadmap = vision; Backlog = not yet broken down; Ready = start work. The local action plan/roadmap are reference only.
4. **If work is tracked on the board:** Set yourself (Agent) via UI or script. See [RULES.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/RULES.md).
5. **Define your rollback plan** (baseline, rollback steps, verification).
6. **Then start.** Before ending a session: update **messmass-codex-brain-dump.md**.

---

# How to Come Back to the Loop (MessMass)

When you **lose context** while working on MessMass:

1. **Re-anchor:** Read **messmass-codex-brain-dump.md** (local: `messmass/docs/messmass-codex-brain-dump.md`), then this doc’s Reminder and “Ground Zero”.
2. **Re-orient:** Check the [board](https://github.com/users/moldovancsaba/projects/1) for **Product = messmass**, **Status = Ready** (next task). In messmass, open **operations-release-notes.md** (last delivered) — local: `messmass/docs/operations/operations-release-notes.md`.
3. **Re-scope:** Re-read the task and any linked doc; run `git status` and `git log -3 --oneline` in the messmass repo.
4. **Re-apply rules:** Documentation = code; single-place rule; update brain dump at end of session.
5. **Then continue.** If anything is unclear, ask. Never assume.

---

# Ground Zero Prerequisite (Non-Negotiable)

- **Rollback plan:** Every delivery must include a Safety Rollback Plan (baseline, exact rollback steps, verification). No exceptions.
- **Documentation = code:** Update docs with every change. No placeholders. Each doc contains only what belongs there (ROADMAP / ACTION PLAN / RELEASE_NOTES).

---

# Handoff and project board (MVP Factory)

- **Create work as issues** in [mvp-factory-control](https://github.com/moldovancsaba/mvp-factory-control); use issue templates. Do not bypass templates.
- **Approve work** by moving the card to **Ready** on the [MVP Factory Board](https://github.com/users/moldovancsaba/projects/1). Work starts only after Ready.
- **Set Agent and Product:** On each card set **Agent** to a current board option (currently `Gwen`, `Chappie`, `Tribeca`) and **Product** (messmass). Use the board UI or this repo’s script:  
  **`./scripts/mvp-factory-set-project-fields.sh ISSUE_NUMBER --agent YourName`**  
  (One-time: [SETUP.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/SETUP.md) — `gh auth refresh -h github.com -s read:project,project`.)
- **No overwrite:** The script reads current board state and only updates fields you pass; other fields stay unchanged.
- **Full rules:** [RULES.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/RULES.md). **Keeping board and repo in sync:** [SYNC.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/SYNC.md).

---

# Team and where you work

- **Sultan** — Product Owner  
- **AI Developer Agents** — assigned from board Agent options (currently `Gwen`, `Chappie`, `Tribeca`)  

**You work in the MessMass repo** for code and product documentation. **You use mvp-factory-control** for issues, board, and project rules (this doc, RULES, SETUP, SYNC, script).

---

# MessMass repo — core docs (when working in messmass)

| Doc | Purpose | GitHub | Local path |
|-----|---------|--------|------------|
| operations-action-plan.md | Execution queue (reference only; source of truth is the board). | [messmass/docs/operations/operations-action-plan.md](https://github.com/moldovancsaba/messmass/blob/main/docs/operations/operations-action-plan.md) | `messmass/docs/operations/operations-action-plan.md` |
| operations-roadmap.md | Future vision (reference only; source of truth is the board). | [messmass/docs/operations/operations-roadmap.md](https://github.com/moldovancsaba/messmass/blob/main/docs/operations/operations-roadmap.md) | `messmass/docs/operations/operations-roadmap.md` |
| operations-release-notes.md | Completed work only. | [messmass/docs/operations/operations-release-notes.md](https://github.com/moldovancsaba/messmass/blob/main/docs/operations/operations-release-notes.md) | `messmass/docs/operations/operations-release-notes.md` |
| operations-learnings.md | Learnings and solutions. | [messmass/docs/operations/operations-learnings.md](https://github.com/moldovancsaba/messmass/blob/main/docs/operations/operations-learnings.md) | `messmass/docs/operations/operations-learnings.md` |
| architecture.md | System architecture and constraints. | [messmass/docs/architecture.md](https://github.com/moldovancsaba/messmass/blob/main/docs/architecture.md) | `messmass/docs/architecture.md` |
| messmass-codex-brain-dump.md | Current job, where we left off, open decisions. | [messmass/docs/messmass-codex-brain-dump.md](https://github.com/moldovancsaba/messmass/blob/main/docs/messmass-codex-brain-dump.md) | `messmass/docs/messmass-codex-brain-dump.md` |

Single-place rule: ROADMAP = vision; action plan = open tasks; RELEASE_NOTES = completed. Do not duplicate.

---

# mvp-factory-control (this repo) — project and board

| Doc | Purpose | GitHub | Local path |
|-----|---------|--------|------------|
| RULES.md | Board rules: create issues only, use templates, Ready = start, set Agent/Product, no overwrite. | [docs/RULES.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/RULES.md) | `mvp-factory-control/docs/RULES.md` |
| SETUP.md | One-time: grant `gh` project scope for scripts. | [docs/SETUP.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/SETUP.md) | `mvp-factory-control/docs/SETUP.md` |
| SYNC.md | Board and repo sync; new issues → board; MVP_PROJECT_TOKEN. | [docs/SYNC.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/SYNC.md) | `mvp-factory-control/docs/SYNC.md` |
| mvp-factory-set-project-fields.sh | Set Status, Agent, Product, Type, Priority; reads current state first. | [scripts/...](https://github.com/moldovancsaba/mvp-factory-control/blob/main/scripts/mvp-factory-set-project-fields.sh) | `mvp-factory-control/scripts/mvp-factory-set-project-fields.sh` |

---

# Summary for agents working on MessMass

| I want to… | Do this |
|------------|---------|
| Know MessMass agent rules | Read this document. |
| Know board/project rules | [docs/RULES.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/RULES.md) (local: `mvp-factory-control/docs/RULES.md`). |
| Get board access (script) | One-time: [docs/SETUP.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/SETUP.md). Then run **`./scripts/mvp-factory-set-project-fields.sh ISSUE_NUM --agent MyName`**. |
| See the board | [MVP Factory Board (Project 1)](https://github.com/users/moldovancsaba/projects/1). |
| Get next MessMass task | Check board for **Product = messmass**, **Status = Ready**. |
| Create a new task | Create an issue in [mvp-factory-control](https://github.com/moldovancsaba/mvp-factory-control) (use a template); add to board; set Agent/Product/Status. |

---

**Document name:** `agent-operating-document-messmass.md` — MessMass project agent rules in the unified knowledge center (mvp-factory-control).  
**Repo:** [moldovancsaba/mvp-factory-control](https://github.com/moldovancsaba/mvp-factory-control)  
**Product repo:** [moldovancsaba/messmass](https://github.com/moldovancsaba/messmass)
