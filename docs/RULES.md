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
- Status flow: `Backlog` → `Ready` (start work) → `In Progress` → `Review` → `Done` (and optionally `Blocked`).

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
| **Status** | Workflow state    | Backlog, Ready, In Progress, Review, Done, Blocked |
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

## Summary

| Rule | Meaning |
|------|--------|
| Work = issues here | All work is an issue in mvp-factory-control; cards on the board. |
| Use templates | Create issues with the repo’s issue templates; never bypass. |
| Ready = start | Do not start work until the card is in **Ready**. |
| Set Agent & Product | Every card has Agent and Product set. |
| No overwrite | Script and behaviour: only change what you pass; leave the rest as on the board. |
