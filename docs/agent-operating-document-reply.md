# Agent Operating Document — Reply Project

**Product**: Reply (local reply app; optional board/messaging integration)  
**Product repo**: [moldovancsaba/reply](https://github.com/moldovancsaba/reply)  
**This doc**: Stored in the **mvp-factory-control** unified knowledge center. It describes how agents work on the **Reply** product and how Reply ties into the [MVP Factory Board](https://github.com/users/moldovancsaba/projects/1).  
**Roles**: Sultan = Product Owner; Agent = AI Developer  
**Last updated**: 2026-02-16 (initial onboarding).

---

## Where this document lives (unified knowledge center)

This file lives in **[moldovancsaba/mvp-factory-control](https://github.com/moldovancsaba/mvp-factory-control)** so all project-related agentic docs are in one place. When working on **Reply** (code in the reply repo), use this doc for agent rules and for how Reply connects to the board.

- **Board and project rules**: [RULES.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/RULES.md), [SETUP.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/SETUP.md), [SYNC.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/SYNC.md).
- **Script to set board fields**: [scripts/mvp-factory-set-project-fields.sh](https://github.com/moldovancsaba/mvp-factory-control/blob/main/scripts/mvp-factory-set-project-fields.sh) (in this repo).
- **Reply code and docs**: In the **reply** repo — see "Where documents are (for agents)" below for exact paths and URLs.

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

**reply (product repo):**

| Doc | GitHub URL | Local path (when cloned) |
|-----|------------|---------------------------|
| ROADMAP | https://github.com/moldovancsaba/reply/blob/main/docs/ROADMAP.md | `reply/docs/ROADMAP.md` (e.g. `Projects/reply/docs/ROADMAP.md`) |
| TASKLIST | https://github.com/moldovancsaba/reply/blob/main/docs/TASKLIST.md | `reply/docs/TASKLIST.md` |
| RELEASE_NOTES | https://github.com/moldovancsaba/reply/blob/main/docs/RELEASE_NOTES.md | `reply/docs/RELEASE_NOTES.md` |
| POC first functions | https://github.com/moldovancsaba/reply/blob/main/docs/POC_FIRST_FUNCTIONS.md | `reply/docs/POC_FIRST_FUNCTIONS.md` |
| INGESTION | https://github.com/moldovancsaba/reply/blob/main/docs/INGESTION.md | `reply/docs/INGESTION.md` |
| brain dump | https://github.com/moldovancsaba/reply/blob/main/docs/reply-codex-brain-dump.md | `reply/docs/reply-codex-brain-dump.md` |

If your workspace has both repos under a common parent (e.g. `Projects/`), full paths are: **`<workspace>/reply/docs/<file>`** and **`<workspace>/mvp-factory-control/docs/<file>`**.

---

# Reminder — Use This When Your Context Is Reset

**What this document is:** The single source of truth for agent development on the **Reply** product. If you have no memory of prior work, read this block and "How to Start" / "How to Come Back" first.

**Rules at a glance:**
- **Documentation = code:** Update docs with every change. No placeholders, no TBD.
- **Single-place rule:** ROADMAP = vision only. TASKLIST = open tasks only. RELEASE_NOTES = completed only. Do not duplicate tasks across the three.
- **Project board (MVP Factory):** Work is tracked as issues in **mvp-factory-control** and as cards on the [MVP Factory Board](https://github.com/users/moldovancsaba/projects/1). Create issues only; use templates; work starts when the card is in **Ready**. Set **Agent**, **Product** (reply), **Status**, **Priority** via [RULES.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/RULES.md) and the [script](https://github.com/moldovancsaba/mvp-factory-control/blob/main/scripts/mvp-factory-set-project-fields.sh).

---

# How to Start (Cold Start) — Reply

When **starting fresh** on Reply (new session, new task):

1. **In the reply repo:** Read **reply-codex-brain-dump.md** (current job, where we left off) — [GitHub](https://github.com/moldovancsaba/reply/blob/main/docs/reply-codex-brain-dump.md), local: `reply/docs/reply-codex-brain-dump.md`.
2. **Read this document** (Reminder, "How to come back", "Ground Zero").
3. **Next task:** Check the [MVP Factory Board](https://github.com/users/moldovancsaba/projects/1) for cards with **Product = reply** and **Status = Ready**. Roadmap = vision; Backlog = not yet broken down; Ready = start work. The local TASKLIST/ROADMAP are reference only.
4. **If work is tracked on the board:** Set yourself (Agent) via UI or script. See [RULES.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/RULES.md).
5. **Then start.** Before ending a session: update **reply-codex-brain-dump.md**.

---

# How to Come Back to the Loop (Reply)

When you **lose context** while working on Reply:

1. **Re-anchor:** Read **reply-codex-brain-dump.md** (local: `reply/docs/reply-codex-brain-dump.md`), then this doc's Reminder and "Ground Zero".
2. **Re-orient:** Check the [board](https://github.com/users/moldovancsaba/projects/1) for **Product = reply**, **Status = Ready** (next task). In reply, open **RELEASE_NOTES.md** (last delivered) — local: `reply/docs/RELEASE_NOTES.md`.
3. **Re-scope:** Re-read the task and any linked doc; run `git status` and `git log -3 --oneline` in the reply repo.
4. **Re-apply rules:** Documentation = code; single-place rule; update brain dump at end of session.
5. **Then continue.** If anything is unclear, ask. Never assume.

---

# Ground Zero Prerequisite (Non-Negotiable)

- **Documentation = code:** Update docs with every change. No placeholders. Each doc contains only what belongs there (ROADMAP / TASKLIST / RELEASE_NOTES).

---

# Handoff and project board (MVP Factory)

- **Create work as issues** in [mvp-factory-control](https://github.com/moldovancsaba/mvp-factory-control); use issue templates. Do not bypass templates.
- **Approve work** by moving the card to **Ready** on the [MVP Factory Board](https://github.com/users/moldovancsaba/projects/1). Work starts only after Ready.
- **Set Agent and Product:** On each card set **Agent** to a current board option (e.g. `Gwen`, `Chappie`, `Tribeca`, `Chihiro`) and **Product** (reply). Use the board UI or this repo's script:  
  **`./scripts/mvp-factory-set-project-fields.sh ISSUE_NUMBER --agent YourName`**  
  (One-time: [SETUP.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/SETUP.md) — `gh auth refresh -h github.com -s read:project,project`.)
- **No overwrite:** The script reads current board state and only updates fields you pass; other fields stay unchanged.
- **Full rules:** [RULES.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/RULES.md). **Keeping board and repo in sync:** [SYNC.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/SYNC.md).

---

# Team and where you work

- **Sultan** — Product Owner  
- **AI Developer Agents** — assigned from board Agent options (e.g. Gwen, Chappie, Tribeca, Chihiro)  

**You work in the Reply repo** for code and product documentation. **You use mvp-factory-control** for issues, board, and project rules (this doc, RULES, SETUP, SYNC, script).

---

# Reply repo — core docs (when working in reply)

| Doc | Purpose | GitHub | Local path |
|-----|---------|--------|------------|
| ROADMAP.md | Future vision (reference only; source of truth is the board). | [reply/docs/ROADMAP.md](https://github.com/moldovancsaba/reply/blob/main/docs/ROADMAP.md) | `reply/docs/ROADMAP.md` |
| TASKLIST.md | Open tasks (reference only; source of truth is the board). | [reply/docs/TASKLIST.md](https://github.com/moldovancsaba/reply/blob/main/docs/TASKLIST.md) | `reply/docs/TASKLIST.md` |
| RELEASE_NOTES.md | Completed work only. | [reply/docs/RELEASE_NOTES.md](https://github.com/moldovancsaba/reply/blob/main/docs/RELEASE_NOTES.md) | `reply/docs/RELEASE_NOTES.md` |
| POC_FIRST_FUNCTIONS.md | First POC capabilities: knowledge injection + localhost chat. | [reply/docs/POC_FIRST_FUNCTIONS.md](https://github.com/moldovancsaba/reply/blob/main/docs/POC_FIRST_FUNCTIONS.md) | `reply/docs/POC_FIRST_FUNCTIONS.md` |
| reply-codex-brain-dump.md | Current job, where we left off, open decisions. | [reply/docs/reply-codex-brain-dump.md](https://github.com/moldovancsaba/reply/blob/main/docs/reply-codex-brain-dump.md) | `reply/docs/reply-codex-brain-dump.md` |

Single-place rule: ROADMAP = vision; TASKLIST = open tasks; RELEASE_NOTES = completed. Do not duplicate.

---

# mvp-factory-control (this repo) — project and board

| Doc | Purpose | GitHub | Local path |
|-----|---------|--------|------------|
| RULES.md | Board rules: create issues only, use templates, Ready = start, set Agent/Product, no overwrite. | [docs/RULES.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/RULES.md) | `mvp-factory-control/docs/RULES.md` |
| SETUP.md | One-time: grant `gh` project scope for scripts. | [docs/SETUP.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/SETUP.md) | `mvp-factory-control/docs/SETUP.md` |
| SYNC.md | Board and repo sync; new issues → board; MVP_PROJECT_TOKEN. | [docs/SYNC.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/SYNC.md) | `mvp-factory-control/docs/SYNC.md` |
| mvp-factory-set-project-fields.sh | Set Status, Agent, Product, Type, Priority; reads current state first. | [scripts/...](https://github.com/moldovancsaba/mvp-factory-control/blob/main/scripts/mvp-factory-set-project-fields.sh) | `mvp-factory-control/scripts/mvp-factory-set-project-fields.sh` |

---

# Summary for agents working on Reply

| I want to… | Do this |
|------------|---------|
| Know Reply agent rules | Read this document. |
| Know board/project rules | [docs/RULES.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/RULES.md) (local: `mvp-factory-control/docs/RULES.md`). |
| Get board access (script) | One-time: [docs/SETUP.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/SETUP.md). Then run **`./scripts/mvp-factory-set-project-fields.sh ISSUE_NUM --agent MyName`**. |
| See the board | [MVP Factory Board (Project 1)](https://github.com/users/moldovancsaba/projects/1). |
| Get next Reply task | Check board for **Product = reply**, **Status = Ready**. |
| Create a new task | Create an issue in [mvp-factory-control](https://github.com/moldovancsaba/mvp-factory-control) (use a template); add to board; set Agent/Product/Status. |

---

**Document name:** `agent-operating-document-reply.md` — Reply project agent rules in the unified knowledge center (mvp-factory-control).  
**Repo:** [moldovancsaba/mvp-factory-control](https://github.com/moldovancsaba/mvp-factory-control)  
**Product repo:** [moldovancsaba/reply](https://github.com/moldovancsaba/reply)
