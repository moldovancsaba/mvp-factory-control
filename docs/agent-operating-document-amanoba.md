# Agent Operating Document — Amanoba Project

**Product**: Amanoba (unified 30-day learning platform)  
**Product repo**: [moldovancsaba/amanoba](https://github.com/moldovancsaba/amanoba)  
**This doc**: Stored in the **mvp-factory-control** unified knowledge center. It describes how agents work on the **Amanoba** product and how Amanoba ties into the [MVP Factory Board](https://github.com/users/moldovancsaba/projects/1).  
**Roles**: Sultan = Product Owner; Agent = AI Developer  
**Last updated**: 2026-02-07 (project management: board, handoff, scripts, RULES, SETUP, SYNC).

---

## Where this document lives (unified knowledge center)

This file lives in **[moldovancsaba/mvp-factory-control](https://github.com/moldovancsaba/mvp-factory-control)** so all project-related agentic docs are in one place. When working on **Amanoba** (code in the amanoba repo), use this doc for agent rules and for how Amanoba connects to the board.

- **Board and project rules**: This repo’s [RULES.md](RULES.md), [SETUP.md](SETUP.md), [SYNC.md](SYNC.md).
- **Script to set board fields**: This repo’s [scripts/mvp-factory-set-project-fields.sh](../scripts/mvp-factory-set-project-fields.sh) (or the same script in the amanoba repo).
- **Amanoba code and task list**: In the **amanoba** repo — ROADMAP, TASKLIST, RELEASE_NOTES, layout_grammar, etc. (paths below refer to the amanoba repo when you work there).

---

# Reminder — Use This When Your Context Is Reset

**What this document is:** The single source of truth for agent development on the **Amanoba** product. If you have no memory of prior work, read this block and “How to Start” / “How to Come Back” first.

**Rules at a glance:**
- **Rollback plan** required for every delivery (baseline + exact steps + verification). No exceptions.
- **Documentation = code:** Update docs with every change. No placeholders, no TBD.
- **Single-place rule:** ROADMAP = vision only. TASKLIST = what to do. RELEASE_NOTES = what’s done. Do not duplicate tasks across the three.
- **Only related items:** ROADMAP = future vision only; TASKLIST = open tasks only; RELEASE_NOTES = completed only.
- **Layout / content / course / UI:** In the amanoba repo, read **`docs/layout_grammar.md`** first when touching content or structure.
- **Project board (MVP Factory):** Work is tracked as issues in **mvp-factory-control** and as cards on the [MVP Factory Board](https://github.com/users/moldovancsaba/projects/1). Create issues only; use templates; work starts when the card is in **Ready**. Set **Agent**, **Product** (e.g. amanoba), **Status**, **Priority** via [RULES.md](RULES.md) and [scripts/mvp-factory-set-project-fields.sh](../scripts/mvp-factory-set-project-fields.sh). See this repo’s [SETUP.md](SETUP.md) for one-time `gh` project scope.
- **Auth / NextAuth / service worker (amanoba):** Do not modify without explicit approval.

---

# How to Start (Cold Start) — Amanoba

When **starting fresh** on Amanoba (new session, new task):

1. **In the amanoba repo:** Read **`docs/amanoba_codex_brain_dump.md`** (current job, where we left off).
2. **Read this document** (Reminder, “How to come back”, “Ground Zero”).
3. **In the amanoba repo:** Read **`docs/TASKLIST.md`** — next actionable task. Read **`docs/ROADMAP.md`** for context.
4. **If work is tracked on the board:** Check [MVP Factory Board](https://github.com/users/moldovancsaba/projects/1); set yourself (Agent) via UI or script. See this repo’s [RULES.md](RULES.md).
5. **If the work touches content, course, lesson, quiz, or UI:** In amanoba, read **`docs/layout_grammar.md`** before coding.
6. **Define your rollback plan** (baseline, rollback steps, verification).
7. **Then start.** Before ending a session: update amanoba’s **`docs/amanoba_codex_brain_dump.md`**.

---

# How to Come Back to the Loop (Amanoba)

When you **lose context** while working on Amanoba:

1. **Re-anchor:** Read amanoba’s **`docs/amanoba_codex_brain_dump.md`**, then this doc’s Reminder and “Ground Zero”.
2. **Re-orient:** In amanoba, open **`docs/TASKLIST.md`** (next task) and **`docs/RELEASE_NOTES.md`** (last delivered).
3. **Re-scope:** Re-read the task and any linked doc; run `git status` and `git log -3 --oneline` in the amanoba repo.
4. **Re-apply rules:** Documentation = code; single-place rule; layout → amanoba’s **`docs/layout_grammar.md`**. Update brain dump at end of session.
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
  (One-time: [SETUP.md](SETUP.md) — `gh auth refresh -h github.com -s read:project,project`.)
- **No overwrite:** The script reads current board state and only updates fields you pass; other fields stay unchanged.
- **Full rules:** [RULES.md](RULES.md). **Keeping board and repo in sync:** [SYNC.md](SYNC.md).

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

| In amanoba repo | Purpose |
|-----------------|---------|
| **docs/TASKLIST.md** | Actionable tasks. When done → move to RELEASE_NOTES and remove from TASKLIST. |
| **docs/ROADMAP.md** | Future vision and client benefits only. |
| **docs/RELEASE_NOTES.md** | Completed work only. |
| **docs/layout_grammar.md** | Mandatory for content, course, lesson, quiz, UI, doc structure. |
| **docs/amanoba_codex_brain_dump.md** | Current job, where we left off, open decisions. |

Single-place rule: ROADMAP = vision; TASKLIST = open tasks; RELEASE_NOTES = completed. Do not duplicate.

---

# mvp-factory-control (this repo) — project and board

| In this repo | Purpose |
|--------------|---------|
| **[RULES.md](RULES.md)** | Rules for the project board: create issues only, use templates, Ready = start, set Agent/Product, no overwrite. |
| **[SETUP.md](SETUP.md)** | One-time: grant `gh` project scope so scripts can read/update the board. |
| **[SYNC.md](SYNC.md)** | Keeping board and repo in sync; new issues → board (Action); MVP_PROJECT_TOKEN secret. |
| **[scripts/mvp-factory-set-project-fields.sh](../scripts/mvp-factory-set-project-fields.sh)** | Set Status, Agent, Product, Type, Priority for an issue; reads current state first. |

---

# Summary for agents working on Amanoba

| I want to… | Do this |
|------------|--------|
| Know Amanoba agent rules | Read this document (and amanoba’s layout_grammar when touching content/structure). |
| Know board/project rules | Read this repo’s [RULES.md](RULES.md). |
| Get board access (script) | One-time: this repo’s [SETUP.md](SETUP.md). Then run **`./scripts/mvp-factory-set-project-fields.sh ISSUE_NUM --agent MyName`** from this repo (or amanoba if the script is there). |
| See the board | [MVP Factory Board (Project 1)](https://github.com/users/moldovancsaba/projects/1). |
| Get next Amanoba task | In the **amanoba** repo, read **docs/TASKLIST.md**. |
| Create a new task | Create an issue in [mvp-factory-control](https://github.com/moldovancsaba/mvp-factory-control) (use a template); it can auto-add to the board. Set Agent/Product. |

---

**Document name:** `agent-operating-document-amanoba.md` — Amanoba project agent rules in the unified knowledge center (mvp-factory-control).  
**Repo:** [moldovancsaba/mvp-factory-control](https://github.com/moldovancsaba/mvp-factory-control)  
**Product repo:** [moldovancsaba/amanoba](https://github.com/moldovancsaba/amanoba)
