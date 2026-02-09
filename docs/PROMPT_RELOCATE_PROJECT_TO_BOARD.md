# Prompt: Relocate project management into MVP Factory Control and the GitHub Project

**Use this prompt** when you want any agent (or human) to move a product’s project management from local task/roadmap files into **mvp-factory-control** and the **GitHub Project (MVP Factory Board)**. Copy the block below and replace `<PRODUCT>` and `<PRODUCT_REPO>` with the real product name and repo (e.g. `doneisbetter`, `messmass`).

---

## Copy-paste prompt (replace placeholders)

```
Relocate this product’s project management into the MVP Factory Control repo and the GitHub Project board. Follow these steps exactly.

**Context**
- **Control repo:** [moldovancsaba/mvp-factory-control](https://github.com/moldovancsaba/mvp-factory-control) — holds issues that drive the board. All agents and products use it.
- **Board:** [GitHub Project 1 — MVP Factory Board](https://github.com/users/moldovancsaba/projects/1). Fields: Status (Roadmap | Backlog | Ready | In Progress | Review | Done), Agent, Product, Type, Priority. Work starts only when Status = Ready.
- **This product:** <PRODUCT> (repo: <PRODUCT_REPO>). Example: amanoba (repo: moldovancsaba/amanoba).

**Your task**
1. **Read the rules and process**  
   In mvp-factory-control: [docs/RULES.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/RULES.md), [docs/SETUP.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/SETUP.md), [docs/MIGRATION_ROADMAP_TASKLIST.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/MIGRATION_ROADMAP_TASKLIST.md). Ensure `gh` has project scope (SETUP.md).

2. **Ensure the board has this product**  
   On the [MVP Factory Board](https://github.com/users/moldovancsaba/projects/1), the **Product** field must include an option for `<PRODUCT>`. If it does not, add it in the project’s field settings (e.g. “Single select” → add option `<PRODUCT>`).

3. **Migrate roadmap and tasklist into the board**  
   - **Roadmap items** (future vision, not yet broken down): Create one issue in mvp-factory-control per item. Add each issue to the project (they’re auto-added on open, or add manually). Set **Status = Roadmap**, **Product = <PRODUCT>**, and other fields as needed (e.g. Type = Feature, Agent, Priority). Use [scripts/mvp-factory-set-project-fields.sh](https://github.com/moldovancsaba/mvp-factory-control/blob/main/scripts/mvp-factory-set-project-fields.sh):  
     `./scripts/mvp-factory-set-project-fields.sh ISSUE_NUMBER --status Roadmap --product <PRODUCT>`
   - **Tasklist items not broken down** (scoping, “define”, “design”): Create one issue per such item. Set **Status = Backlog**, **Product = <PRODUCT>**.
   - **Tasklist items that are broken down to actionable deliverables**: Create one issue per item. Set **Status = Ready** (or Backlog until approved, then move to Ready), **Product = <PRODUCT>**.
   - For every issue you create, set **Product = <PRODUCT>** so the card appears in this product’s swimlane. Use the script:  
     `./scripts/mvp-factory-set-project-fields.sh ISSUE_NUMBER --product <PRODUCT>`  
     (and optionally `--status`, `--agent`, `--priority`).

4. **Option: use or adapt the migration script**  
   The repo has [scripts/migrate-roadmap-tasklist-to-project.sh](https://github.com/moldovancsaba/mvp-factory-control/blob/main/scripts/migrate-roadmap-tasklist-to-project.sh) for amanoba. For another product you can: (a) run a similar migration manually (create issues + set fields as above), or (b) copy and adapt the script to read <PRODUCT_REPO>’s ROADMAP.md / TASKLIST.md (or equivalent) and create issues with Product = <PRODUCT>. Run with `--dry-run` first.

5. **Deprecate local task/roadmap files in the product repo**  
   In <PRODUCT_REPO>, add a short notice at the top of ROADMAP.md and TASKLIST.md (or equivalent):  
   “Source of truth is now the [MVP Factory Board](https://github.com/users/moldovancsaba/projects/1). Roadmap = Status Roadmap; Backlog = not broken down; Ready = actionable. Product = <PRODUCT>. This file is reference only.”  
   Link to [docs/MIGRATION_ROADMAP_TASKLIST.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/MIGRATION_ROADMAP_TASKLIST.md) in mvp-factory-control.

6. **Add or update the agent operating doc in mvp-factory-control**  
   - If none exists for this product: create **docs/agent-operating-document-<PRODUCT>.md** in mvp-factory-control using [docs/agent-operating-document-amanoba.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/agent-operating-document-amanoba.md) as a template. Include: product name and repo; “Where documents are” with GitHub URLs and local paths; handoff and board rules; cold start / come back; that the **next task** comes from the board (Product = <PRODUCT>, Status = Ready), not from local TASKLIST.
   - If one exists: update it so “next task” = board (Product = <PRODUCT>, Status = Ready); TASKLIST/ROADMAP in the product repo are reference only.
   - Add a row in mvp-factory-control’s [README “What’s in this repository”](https://github.com/moldovancsaba/mvp-factory-control/blob/main/README.md) for the new agent doc and product repo.

7. **Fix any cards missing Product**  
   After migration, if some cards show “No Product” in the product swimlane: set Product for those issues:  
   `./scripts/mvp-factory-set-project-fields.sh ISSUE_NUMBER --product <PRODUCT>`

**Summary**
- All work is tracked as **issues in mvp-factory-control** and as **cards on the MVP Factory Board**.
- **Roadmap** = vision (Status = Roadmap). **Backlog** = not yet broken down. **Ready** = actionable; work starts when the card is in Ready.
- Every card for this product must have **Product = <PRODUCT>** so it appears in this product’s swimlane.
- Local ROADMAP/TASKLIST in the product repo become reference only; source of truth is the board.
```

---

## After giving the prompt

- Replace **<PRODUCT>** with the product’s short name (e.g. `amanoba`, `doneisbetter`, `messmass`).
- Replace **<PRODUCT_REPO>** with the GitHub repo (e.g. `moldovancsaba/amanoba`).
- Ensure the agent has access to both **mvp-factory-control** and the product repo, and that `gh` is authenticated with project scope (see SETUP.md in mvp-factory-control).
