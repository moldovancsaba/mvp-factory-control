# Migration: ROADMAP.md and TASKLIST.md → GitHub Project

**Purpose:** Move roadmap and tasklist content from local files (e.g. amanoba `docs/ROADMAP.md`, `docs/TASKLIST.md`) into the [MVP Factory Board](https://github.com/users/moldovancsaba/projects/1) so work is tracked in one place and local task files can be deprecated.

---

## Board columns (Status)

The project **Status** field drives the board columns:

| Status    | Meaning |
|----------|---------|
| **Roadmap** | Future vision items (from ROADMAP.md). Not yet broken down to tasks. |
| **Backlog** | Tasklist items that are **not** yet broken down to actionable deliverables (e.g. scoping, “define”, “design”). |
| **Ready**   | Tasklist items that **are** broken down to actionable deliverables; ready to start when approved. |
| In Progress | Someone is working on it. |
| Review     | Implementation done; awaiting review. |
| Done       | Delivered. |
| Blocked    | Waiting on a dependency. |

Work **starts only when Status = Ready** (same rule as before).

---

## What the migration script does

**Script:** [scripts/migrate-roadmap-tasklist-to-project.sh](../scripts/migrate-roadmap-tasklist-to-project.sh)

1. **Roadmap (Status = Roadmap)**  
   Creates one issue per vision item from ROADMAP.md (e.g. “Multiple courses: enrolment + prerequisites”, “Live sessions”, “Mobile app”, “Video lessons”, “Global default certificate”, “Custom certificate library”, etc.). Title prefix: `[Roadmap]`.

2. **Backlog (Status = Backlog)**  
   Creates issues for TASKLIST items that are **not** yet broken down (scoping, define, design). Title prefix: `[P3]` / `[P4]` as in TASKLIST.

3. **Ready (Status = Ready)**  
   Creates issues for TASKLIST items that **are** broken down to actionable deliverables. Does **not** duplicate existing issue #2 (P2 #3 Dashboard/course pages); sets issue #2 to Ready.

4. **Existing issue #2**  
   Sets Status = Ready and Product = amanoba (P2 #3 already exists).

**Requirements:** `gh` CLI with project scope, `jq`. Run from **mvp-factory-control** repo root.

**Usage:**

```bash
# Preview only (no issues created)
./scripts/migrate-roadmap-tasklist-to-project.sh --dry-run

# Run migration (creates issues and sets Status)
./scripts/migrate-roadmap-tasklist-to-project.sh

# Resume after partial run (e.g. if script timed out)
./scripts/migrate-roadmap-tasklist-to-project.sh --skip-roadmap --skip-backlog --skip-ready-first N
```

**Migration completed:** 2026-02-09. Issues: Roadmap #3–10, Backlog #11–15, Ready #2, #16–35. ROADMAP.md and TASKLIST.md in amanoba have a deprecation notice and point to the board.

---

## After migration: deprecating local files

Once the board is populated and you have verified the issues:

1. **amanoba:** Replace or shorten **ROADMAP.md** and **TASKLIST.md** with a pointer to the board:
   - “Roadmap and tasklist are now on the [MVP Factory Board](https://github.com/users/moldovancsaba/projects/1). Roadmap = vision column; Backlog = not yet broken down; Ready = actionable. Product = amanoba.”
   - Optionally keep a minimal ROADMAP.md with vision summary only (no duplicate item list), and remove TASKLIST content in favor of the board.

2. **Agent doc and RULES:** Already say “work is tracked as issues” and “Ready = start”. Update any references that still say “read TASKLIST.md for next task” to “check the board for Ready items (Product = amanoba)”.

3. **RELEASE_NOTES:** Keep in the product repo as the record of **what’s done**. The board “Done” column and RELEASE_NOTES can both reflect completed work; optionally add a line in RELEASE_NOTES: “Board: mvp-factory-control issues, Status = Done.”

---

## Adding new work later

- **New vision item:** Create an issue in mvp-factory-control, add to project, set Status = **Roadmap**, Product = amanoba (or other).
- **New task not yet broken down:** Create issue, set Status = **Backlog**.
- **New actionable task:** Create issue, set Status = **Backlog** until approved, then move to **Ready** when work should start.

No need to edit ROADMAP.md or TASKLIST.md in the product repo if they are deprecated.
