# Centralization: what else to care about

When moving project/agent coordination into **mvp-factory-control** (unified knowledge center), use this as a checklist so nothing important is missed.

---

## 1. Discovery and index

**Care:** How do agents (or humans) know which products exist and where their agent doc is?

- **Do:** Keep a single index of “product → agent doc.” Today that’s the **README** table “What’s in this repository” (e.g. agent-operating-document-amanoba.md). When you add a new product agent doc, add a row there.
- **Optional:** Add a dedicated **docs/INDEX.md** listing: Product name | Agent doc (link) | Product repo (link) | Board Product value. Use it when you have several products.

---

## 2. Adding a new product to the board and knowledge center

**Care:** New product (e.g. doneisbetter, messmass) should get the same treatment as amanoba.

- **Board:** Ensure the **Product** field on the [MVP Factory Board](https://github.com/users/moldovancsaba/projects/1) has an option for the new product (add it in the project field settings if it doesn’t exist).
- **Agent doc:** Add **docs/agent-operating-document-<product>.md** in this repo. Follow [RULES.md §8](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/RULES.md) (GitHub URLs, local paths, “Where documents are,” one doc per product, keep dev docs in product repo).
- **README:** Add a row in “What’s in this repository” (and to INDEX.md if you use it) pointing to the new agent doc and product repo.
- **Script defaults:** **scripts/mvp-factory-defaults.env** is global; when running the script for a different product, pass **`--product <name>`** (or set `MVP_PRODUCT`). No need to duplicate the script per product.

---

## 3. Template / consistency for agent docs

**Care:** All product agent docs should follow the same structure so agents know where to find things.

- **Do:** Use **docs/agent-operating-document-amanoba.md** as the reference. New product agent docs should include:
  - Header: product name, product repo link, “this doc lives in mvp-factory-control,” last updated.
  - **Where this document lives** + links to RULES, SETUP, SYNC, script.
  - **Where documents are (for agents):** tables with GitHub URL + local path for this repo and the product repo.
  - **Reminder** (rules at a glance).
  - **How to Start** / **How to Come Back** (cold start, loopback).
  - **Handoff and project board** (create issues here, Ready = start, set Agent/Product, script, no overwrite).
  - **Team and where you work.**
  - **Core docs tables** (this repo + product repo).
  - **Summary for agents** (I want to… → Do this).
- **Optional:** Add **docs/templates/agent-operating-document-TEMPLATE.md** as a copy-paste starting point for new products.

---

## 4. Avoiding drift with product repos

**Care:** The agent doc in mvp-factory-control can drift from how the product repo actually works (e.g. new docs, renamed files, changed process).

- **Do:** Keep **product development docs** (TASKLIST, ROADMAP, RELEASE_NOTES, layout_grammar, etc.) **in the product repo only**. The agent doc here only **references** them (GitHub URL + local path). That way there’s one source of truth per doc.
- **Do:** When you change process or add important docs in the product repo, update the **“Where documents are”** (and any references) in the corresponding **agent-operating-document-<product>.md** in this repo.
- **Do:** Set a **Last updated** (or “Last reviewed”) in each agent doc and revisit when the product’s workflow or doc layout changes.

---

## 5. Secrets and access

**Care:** Who can change what, and what tokens exist?

- **MVP_PROJECT_TOKEN:** Documented in [SYNC.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/SYNC.md). Needed so the “add issue to project” Action can run. Only people with repo admin (or permission to manage Actions secrets) can add or rotate it.
- **No product-specific tokens in this repo** for now; the script uses `gh` (user’s own auth). If you later add per-product or per-environment tokens, document them in SETUP or SYNC and who may change them.

---

## 6. Single entry point for new agents

**Care:** A new agent (human or AI) should know where to start.

- **Do:** **README** of mvp-factory-control is the entry point: it points to RULES, SETUP, SYNC, script, and the list of agent docs (e.g. agent-operating-document-amanoba.md).
- **Do:** In README or here, one short **“Onboarding”** line: clone mvp-factory-control (and the product repo you work on), complete [SETUP.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/SETUP.md) once, read [RULES.md](https://github.com/moldovancsaba/mvp-factory-control/blob/main/docs/RULES.md) and the **agent doc for your product**.

---

## 7. Naming and layout conventions

**Care:** Consistent names and paths make automation and discovery easier.

- **Agent docs:** **docs/agent-operating-document-&lt;product&gt;.md** (e.g. `agent-operating-document-amanoba.md`, `agent-operating-document-doneisbetter.md`).
- **Local path convention:** **`<repo-folder>/docs/<file>`** or **`<repo-folder>/scripts/<file>`** where `<repo-folder>` is the clone name (e.g. `amanoba`, `mvp-factory-control`). Documented in RULES §8.

---

## 8. Project documents in the product folder (uniformity)

**Care:** In each **product repo** (e.g. amanoba), docs in `docs/` are not yet fully uniform. When centralising or onboarding new products, be aware of the following.

**Current situation (example: amanoba):**

- **Index exists:** [DOCS_INDEX.md](https://github.com/moldovancsaba/amanoba/blob/main/docs/DOCS_INDEX.md) defines *core* vs *feature/reference* vs *deprecated* vs *dated*. Use it as the single entry for “what matters” in that repo.
- **Naming is mixed:** Core docs use **UPPER_SNAKE** (e.g. `TASKLIST.md`, `ROADMAP.md`, `RELEASE_NOTES.md`, `LEARNINGS.md`) or **UPPERCASE** (`CONTRIBUTING.md`, `ARCHITECTURE.md`). Other docs use **snake_case** or **lowercase** (e.g. `layout_grammar.md`, `amanoba_codex_brain_dump.md`). The product’s [NAMING_GUIDE.md](https://github.com/moldovancsaba/amanoba/blob/main/docs/NAMING_GUIDE.md) recommends **kebab-case, lowercase** for files — so doc filenames are not yet aligned with that guide.
- **Agent doc “Where documents are”:** The agent operating doc in mvp-factory-control lists a **subset** of core docs (TASKLIST, ROADMAP, RELEASE_NOTES, layout_grammar, brain dump, LEARNINGS). It does not list every core doc from DOCS_INDEX (e.g. ARCHITECTURE, CONTRIBUTING). That is intentional: the table is “what agents need most”; for full inventory, use the product’s DOCS_INDEX.
- **Many one-off docs:** Product `docs/` often contains many ad-hoc files (audits, migrations, SSO_*, QUIZ_*, etc.). DOCS_INDEX and `_archive/` help separate “current source of truth” from “reference or historical.”

**Recommendations:**

- **Do not** rename core docs in the product repo purely for uniformity unless the product owner agrees; renaming breaks links and agent paths.
- **Do** keep one **DOCS_INDEX** (or equivalent) per product and keep it updated when adding or retiring docs.
- **Do** align **new** product repos: pick one convention (e.g. UPPER_SNAKE for core process docs, or kebab-case everywhere) and document it in that product’s CONTRIBUTING or a short docs README.
- **Optional:** In mvp-factory-control, the agent doc’s “Where documents are” can add a row pointing to the product’s **DOCS_INDEX** so agents know where to find the full list.

---

## 9. Optional future checks

**Care:** Over time you might want light automation to keep things consistent.

- **Optional:** A small CI job (e.g. in this repo) that checks that every **docs/agent-operating-document-*.md** contains the string “Where documents are” and “https://github.com” (so we don’t regress to relative-only links). Not required for day one.

---

## Summary

| Area | What to care about |
|------|--------------------|
| **Discovery** | Index of products and agent docs (README table; optional INDEX.md). |
| **New product** | Add Product on board, add agent doc + README row, use script with `--product`. |
| **Consistency** | Same structure for all agent docs; use amanoba doc as reference (optional template). |
| **Drift** | Keep dev docs in product repo; update “Where documents are” when product docs change; set Last updated. |
| **Secrets** | Document who can set MVP_PROJECT_TOKEN; no product tokens here unless you add and document them. |
| **Onboarding** | README as entry point; one-line onboarding: clone, SETUP, RULES, product agent doc. |
| **Naming** | agent-operating-document-&lt;product&gt;.md; local path &lt;repo-folder&gt;/docs/ or /scripts/. |
| **Product docs uniformity** | One DOCS_INDEX per product; naming may be mixed (see §8); agent doc lists subset; new products pick one convention. |

---

**Doc:** Part of the mvp-factory-control knowledge center. Review when you add a new product or change how centralization works.
