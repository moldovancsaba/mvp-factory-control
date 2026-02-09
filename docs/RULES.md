# Rules for working on the project (MVP Factory Board)

All agents and humans working with the [MVP Factory Board](https://github.com/users/moldovancsaba/projects/1) and this repository must follow these rules.

---

## 1. Work is tracked as issues in this repo

- **This repo:** [moldovancsaba/mvp-factory-control](https://github.com/moldovancsaba/mvp-factory-control)
- **Board:** [GitHub Project 1 — MVP Factory Board](https://github.com/users/moldovancsaba/projects/1)
- Every task is an **issue** in this repo. Issues appear as cards on the board.

---

## 2. Create issues only; use templates

- **Agents create issues only.** Do not start implementation from a raw objective without an issue.
- **Never bypass templates.** Use the issue templates under [.github/ISSUE_TEMPLATE/](../.github/ISSUE_TEMPLATE/) (Feature, Bug, Docs, Refactor, Release, etc.) when creating issues.
- Assign work by instruction, e.g.: *"Create a Feature issue in mvp-factory-control using the Feature template for \<objective\>."*

---

## 3. Approve by moving to Ready; work starts only after Ready

- **Product / you approve** by moving the card to **Ready** on the board.
- **Work starts only when the card is in Ready.** Do not start implementation until the card is in Ready.
- Status flow: `Roadmap` (vision) | `Backlog` (not yet broken down) → `Ready` (start work) → `In Progress` → `Review` → `Done` (and optionally `Blocked`).

---

## 4. Set Agent and Product on the card

- **Agent** = who does the work: Tribeca, Katja, Becca, Gwen, or Chappie.
- **Product** = which product/repo the work belongs to (e.g. amanoba, doneisbetter, messmass).
- Set these on the card (in the GitHub UI or via the script) so the board reflects ownership and context.

---

## 5. Do not overwrite other agents’ fields

- **When using the script** (`scripts/mvp-factory-set-project-fields.sh`): the script **reads the current board state first**. Only the fields you pass (e.g. `--agent Becca` or `--priority P2`) are updated; **all other fields are left unchanged**.
- Do not run the script with full defaults if you only intend to change one field. Pass only the flags you want to change (e.g. `--priority P2` only).
- In the UI, only change the fields you are responsible for.

---

## 6. Board fields (every card)

| Field       | Purpose           | Example values |
|------------|-------------------|----------------|
| **Status** | Workflow state    | Roadmap, Backlog, Ready, In Progress, Review, Done, Blocked |
| **Agent**  | Who does the work | Tribeca, Katja, Becca, Gwen, Chappie |
| **Product**| Which product     | amanoba, doneisbetter, messmass, etc. |
| **Type**   | Kind of work      | Feature, Bug, Refactor, Docs, Audit, Release, Plan |
| **Priority** | Urgency         | P0, P1, P2, P3 |

---

## 7. Script usage (from this repo)

- **One-time:** Complete [docs/SETUP.md](SETUP.md) (grant `gh` project scope).
- **Set yourself on a card:**  
  `./scripts/mvp-factory-set-project-fields.sh ISSUE_NUMBER --agent YourName`
- **Change only one field:**  
  `./scripts/mvp-factory-set-project-fields.sh ISSUE_NUMBER --priority P2`  
  (other fields stay as on the board.)
- **Defaults** (used only when a field has no override and no current value):  
  `scripts/mvp-factory-defaults.env`. Override with `--status`, `--agent`, `--product`, `--type`, `--priority` or env vars `MVP_STATUS`, `MVP_AGENT`, etc.

---

## 8. When adding project docs to this repo (unified knowledge center)

When you move **project-related agent docs** (e.g. agent operating documents for a product) into mvp-factory-control, **all agents** must follow these rules so every doc is resolvable from GitHub and from an agent’s workspace.

### 8.1 Use stable references — no bare relative paths

- **Do not** use relative links that only work inside one repo (e.g. `[RULES](RULES.md)` or `docs/TASKLIST.md` with no context).
- **Do** use one or both of:
  - **Full GitHub URL** for every referenced document (e.g. `https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/RULES.md`, `https://github.com/moldovancsaba/amanoba/blob/main/docs/TASKLIST.md`). Links then work when the doc is viewed on GitHub or from any clone.
  - **Explicit local path** so agents can open the file in the IDE (e.g. `mvp-factory-control/docs/RULES.md`, `amanoba/docs/TASKLIST.md`). Use a convention that does not depend on one machine (e.g. avoid `/Users/username/` unless you document it as an example).

### 8.2 Document “where things are” for agents

- In each project-level agent doc (e.g. `agent-operating-document-<product>.md`), include a **“Where documents are (for agents)”** (or equivalent) section with:
  - **This repo (mvp-factory-control):** table or list of doc name, GitHub URL, and local path (e.g. `mvp-factory-control/docs/RULES.md`).
  - **Product repo(s):** same for the product repo (e.g. amanoba) — doc name, GitHub URL, local path (e.g. `amanoba/docs/TASKLIST.md`).
- Local path format: **`<repo-folder>/docs/<file>`** or **`<repo-folder>/scripts/<file>`**, where `<repo-folder>` is the clone name (e.g. `amanoba`, `mvp-factory-control`). If both repos sit under a common parent (e.g. `Projects/`), you can note: “Full path e.g. `Projects/amanoba/docs/TASKLIST.md`”.

### 8.3 One product doc per product

- Store one main agent operating doc per product in this repo, with a clear name (e.g. `agent-operating-document-amanoba.md`).
- That doc is the single place for “how agents work on product X and how product X ties into the board.” Link to this repo’s RULES, SETUP, SYNC, and script; link to the product repo’s core docs (TASKLIST, ROADMAP, RELEASE_NOTES, etc.) via GitHub URL + local path.

### 8.4 Keep product development docs in the product repo

- **Do not** move TASKLIST, ROADMAP, RELEASE_NOTES, layout_grammar, LEARNINGS, etc. out of the **product repo** (e.g. amanoba) into mvp-factory-control. Those stay with the code. In the agent doc, **reference** them via GitHub URL and local path only.

---

## Summary

| Rule | Meaning |
|------|--------|
| Work = issues here | All work is an issue in mvp-factory-control; cards on the board. |
| Use templates | Create issues with the repo’s issue templates; never bypass. |
| Ready = start | Do not start work until the card is in **Ready**. |
| Set Agent & Product | Every card has Agent and Product set. |
| No overwrite | Script and behaviour: only change what you pass; leave the rest as on the board. |
| **Doc references (knowledge center)** | When adding project/agent docs to this repo: use GitHub URLs + local paths; include a “Where documents are” section; one product doc per product; keep product dev docs (TASKLIST, ROADMAP, etc.) in the product repo. |
