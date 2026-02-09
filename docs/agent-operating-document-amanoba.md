# Agent Operating Document — Amanoba Project

**Product**: Amanoba (unified 30-day learning platform)  
**Product repo**: [moldovancsaba/amanoba](https://github.com/moldovancsaba/amanoba)  
**This doc**: Stored in the **mvp-factory-control** unified knowledge center. It describes how agents work on the **Amanoba** product and how Amanoba ties into the [MVP Factory Board](https://github.com/users/moldovancsaba/projects/1).  
**Roles**: Sultan = Product Owner; Agent = AI Developer  
**Last updated**: 2026-02-07 (project management: board, handoff, scripts, RULES, SETUP, SYNC).

---

## Where this document lives (unified knowledge center)

This file lives in **[moldovancsaba/mvp-factory-control](https://github.com/moldovancsaba/mvp-factory-control)** so all project-related agentic docs are in one place. When working on **Amanoba** (code in the amanoba repo), use this doc for agent rules and for how Amanoba connects to the board.

- **Board and project rules**: [RULES.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/RULES.md), [SETUP.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/SETUP.md), [SYNC.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/SYNC.md).
- **Script to set board fields**: [scripts/mvp-factory-set-project-fields.sh](https://github.com/moldovancsaba/mvp-factory-control/blob/main/scripts/mvp-factory-set-project-fields.sh) (in this repo; same script may exist in amanoba).
- **Amanoba code and task list**: In the **amanoba** repo — see “Where documents are (for agents)” below for exact paths and URLs.

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

**amanoba (product repo):**

| Doc | GitHub URL | Local path (when cloned) |
|-----|------------|---------------------------|
| TASKLIST | https://github.com/moldovancsaba/amanoba/blob/main/docs/TASKLIST.md | `amanoba/docs/TASKLIST.md` (e.g. `Projects/amanoba/docs/TASKLIST.md`) |
| ROADMAP | https://github.com/moldovancsaba/amanoba/blob/main/docs/ROADMAP.md | `amanoba/docs/ROADMAP.md` |
| RELEASE_NOTES | https://github.com/moldovancsaba/amanoba/blob/main/docs/RELEASE_NOTES.md | `amanoba/docs/RELEASE_NOTES.md` |
| layout_grammar | https://github.com/moldovancsaba/amanoba/blob/main/docs/layout_grammar.md | `amanoba/docs/layout_grammar.md` |
| brain dump | https://github.com/moldovancsaba/amanoba/blob/main/docs/amanoba_codex_brain_dump.md | `amanoba/docs/amanoba_codex_brain_dump.md` |
| LEARNINGS | https://github.com/moldovancsaba/amanoba/blob/main/docs/LEARNINGS.md | `amanoba/docs/LEARNINGS.md` |

If your workspace has both repos under a common parent (e.g. `Projects/`), full paths are: **`<workspace>/amanoba/docs/<file>`** and **`<workspace>/mvp-factory-control/docs/<file>`**. Use the path that matches your clone so the agent can resolve the file.

---

# Reminder — Use This When Your Context Is Reset

**What this document is:** The single source of truth for agent development on the **Amanoba** product. If you have no memory of prior work, read this block and “How to Start” / “How to Come Back” first.

**Rules at a glance:**
- **Rollback plan** required for every delivery (baseline + exact steps + verification). No exceptions.
- **Documentation = code:** Update docs with every change. No placeholders, no TBD.
- **Single-place rule:** ROADMAP = vision only. TASKLIST = what to do. RELEASE_NOTES = what’s done. Do not duplicate tasks across the three.
- **Only related items:** ROADMAP = future vision only; TASKLIST = open tasks only; RELEASE_NOTES = completed only.
- **Layout / content / course / UI:** In the amanoba repo, read **layout_grammar** first when touching content or structure — [GitHub](https://github.com/moldovancsaba/amanoba/blob/main/docs/layout_grammar.md), local: `amanoba/docs/layout_grammar.md`.
- **Project board (MVP Factory):** Work is tracked as issues in **mvp-factory-control** and as cards on the [MVP Factory Board](https://github.com/users/moldovancsaba/projects/1). Create issues only; use templates; work starts when the card is in **Ready**. Set **Agent**, **Product** (e.g. amanoba), **Status**, **Priority** via [RULES.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/RULES.md) and the [script](https://github.com/moldovancsaba/mvp-factory-control/blob/main/scripts/mvp-factory-set-project-fields.sh). One-time: [SETUP.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/SETUP.md) for `gh` project scope.
- **Auth / NextAuth / service worker (amanoba):** Do not modify without explicit approval.

---

# How to Start (Cold Start) — Amanoba

When **starting fresh** on Amanoba (new session, new task):

1. **In the amanoba repo:** Read **amanoba_codex_brain_dump.md** (current job, where we left off) — [GitHub](https://github.com/moldovancsaba/amanoba/blob/main/docs/amanoba_codex_brain_dump.md), local: `amanoba/docs/amanoba_codex_brain_dump.md`.
2. **Read this document** (Reminder, “How to come back”, “Ground Zero”).
3. **In the amanoba repo:** Read **TASKLIST.md** (next task) and **ROADMAP.md** (context) — [TASKLIST](https://github.com/moldovancsaba/amanoba/blob/main/docs/TASKLIST.md), [ROADMAP](https://github.com/moldovancsaba/amanoba/blob/main/docs/ROADMAP.md); local: `amanoba/docs/TASKLIST.md`, `amanoba/docs/ROADMAP.md`.
4. **If work is tracked on the board:** Check [MVP Factory Board](https://github.com/users/moldovancsaba/projects/1); set yourself (Agent) via UI or script. See [RULES.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/RULES.md).
5. **If the work touches content, course, lesson, quiz, or UI:** In amanoba, read **layout_grammar.md** before coding — local: `amanoba/docs/layout_grammar.md`.
6. **Define your rollback plan** (baseline, rollback steps, verification).
7. **Then start.** Before ending a session: update amanoba’s **amanoba_codex_brain_dump.md** — local: `amanoba/docs/amanoba_codex_brain_dump.md`.

---

# How to Come Back to the Loop (Amanoba)

When you **lose context** while working on Amanoba:

1. **Re-anchor:** Read amanoba’s **amanoba_codex_brain_dump.md** (local: `amanoba/docs/amanoba_codex_brain_dump.md`), then this doc’s Reminder and “Ground Zero”.
2. **Re-orient:** In amanoba, open **TASKLIST.md** (next task) and **RELEASE_NOTES.md** (last delivered) — local: `amanoba/docs/TASKLIST.md`, `amanoba/docs/RELEASE_NOTES.md`.
3. **Re-scope:** Re-read the task and any linked doc; run `git status` and `git log -3 --oneline` in the amanoba repo.
4. **Re-apply rules:** Documentation = code; single-place rule; layout → amanoba’s **layout_grammar.md** (local: `amanoba/docs/layout_grammar.md`). Update brain dump at end of session.
5. **Then continue.** If anything is unclear, ask. Never assume.

---

# Ground Zero Prerequisite (Non-Negotiable)

- **Rollback plan:** Every delivery must include a Safety Rollback Plan (baseline, exact rollback steps, verification). No exceptions.
- **Documentation = code:** Update docs with every change. No placeholders. Each doc contains only what belongs there (ROADMAP / TASKLIST / RELEASE_NOTES).

---

# Handoff and project board (MVP Factory)

- **Create work as issues** in [mvp-factory-control](https://github.com/moldovancsaba/mvp-factory-control); use issue templates. Do not bypass templates.
- **Approve work** by moving the card to **Ready** on the [MVP Factory Board](https://github.com/users/moldovancsaba/projects/1). Work starts only after Ready.
- **Set Agent and Product:** On each card set **Agent** (Tribeca, Katja, Becca, Gwen, Chappie) and **Product** (e.g. amanoba). Use the board UI or this repo’s script:  
  **`./scripts/mvp-factory-set-project-fields.sh ISSUE_NUMBER --agent YourName`**  
  (One-time: [SETUP.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/SETUP.md) — `gh auth refresh -h github.com -s read:project,project`.)
- **No overwrite:** The script reads current board state and only updates fields you pass; other fields stay unchanged.
- **Full rules:** [RULES.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/RULES.md). **Keeping board and repo in sync:** [SYNC.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/SYNC.md).

---

# Team and where you work

- **Chappie** — Architect (OpenAI ChatGPT)  
- **Katja** — Content Creator, Developer (OpenAI CODEX via Cursor)  
- **Tribeca** — Developer (Auto Agent via Cursor)  
- **Becca, Gwen** — Agents (assign via board)  
- **Sultan** — Product Owner  

**You work in the Amanoba repo** for code, TASKLIST, ROADMAP, RELEASE_NOTES, layout_grammar. **You use mvp-factory-control** for issues, board, and project rules (this doc, RULES, SETUP, SYNC, script).

---

# Amanoba repo — core docs (when working in amanoba)

| Doc | Purpose | GitHub | Local path |
|-----|---------|--------|------------|
| TASKLIST.md | Actionable tasks. When done → RELEASE_NOTES, remove from TASKLIST. | [amanoba/docs/TASKLIST.md](https://github.com/moldovancsaba/amanoba/blob/main/docs/TASKLIST.md) | `amanoba/docs/TASKLIST.md` |
| ROADMAP.md | Future vision and client benefits only. | [amanoba/docs/ROADMAP.md](https://github.com/moldovancsaba/amanoba/blob/main/docs/ROADMAP.md) | `amanoba/docs/ROADMAP.md` |
| RELEASE_NOTES.md | Completed work only. | [amanoba/docs/RELEASE_NOTES.md](https://github.com/moldovancsaba/amanoba/blob/main/docs/RELEASE_NOTES.md) | `amanoba/docs/RELEASE_NOTES.md` |
| layout_grammar.md | Mandatory for content, course, lesson, quiz, UI, doc structure. | [amanoba/docs/layout_grammar.md](https://github.com/moldovancsaba/amanoba/blob/main/docs/layout_grammar.md) | `amanoba/docs/layout_grammar.md` |
| amanoba_codex_brain_dump.md | Current job, where we left off, open decisions. | [amanoba/docs/amanoba_codex_brain_dump.md](https://github.com/moldovancsaba/amanoba/blob/main/docs/amanoba_codex_brain_dump.md) | `amanoba/docs/amanoba_codex_brain_dump.md` |
| LEARNINGS.md | Learnings and solutions. | [amanoba/docs/LEARNINGS.md](https://github.com/moldovancsaba/amanoba/blob/main/docs/LEARNINGS.md) | `amanoba/docs/LEARNINGS.md` |

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

# Summary for agents working on Amanoba

| I want to… | Do this |
|------------|--------|
| Know Amanoba agent rules | Read this document (and amanoba’s layout_grammar when touching content/structure). |
| Know board/project rules | [RULES.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/RULES.md) (local: `mvp-factory-control/docs/RULES.md`). |
| Get board access (script) | One-time: [SETUP.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/SETUP.md). Then run **`./scripts/mvp-factory-set-project-fields.sh ISSUE_NUM --agent MyName`** from the mvp-factory-control clone (or amanoba if the script is there). |
| See the board | [MVP Factory Board (Project 1)](https://github.com/users/moldovancsaba/projects/1). |
| Get next Amanoba task | In the **amanoba** repo: [TASKLIST.md](https://github.com/moldovancsaba/amanoba/blob/main/docs/TASKLIST.md) (local: `amanoba/docs/TASKLIST.md`). |
| Create a new task | Create an issue in [mvp-factory-control](https://github.com/moldovancsaba/mvp-factory-control) (use a template); it can auto-add to the board. Set Agent/Product. |

---

**Document name:** `agent-operating-document-amanoba.md` — Amanoba project agent rules in the unified knowledge center (mvp-factory-control).  
**Repo:** [moldovancsaba/mvp-factory-control](https://github.com/moldovancsaba/mvp-factory-control)  
**Product repo:** [moldovancsaba/amanoba](https://github.com/moldovancsaba/amanoba)
