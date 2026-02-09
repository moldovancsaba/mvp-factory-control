# Keeping the board and repo in sync

This doc explains how the [MVP Factory Board](https://github.com/users/moldovancsaba/projects/1) and the [mvp-factory-control](https://github.com/moldovancsaba/mvp-factory-control) repo stay up to date with each other.

---

## 1. Repo → Board: new issues become cards automatically

When someone (or an agent) **opens a new issue** in this repo, a GitHub Action adds that issue to the project board so it appears as a card.

- **Workflow:** [.github/workflows/add-issue-to-project.yml](../.github/workflows/add-issue-to-project.yml)
- **Trigger:** `issues.opened`
- **Effect:** The new issue is added to [Project 1](https://github.com/users/moldovancsaba/projects/1) via the API.

So: **create all work as issues in this repo**; the board will get the new cards automatically once the secret below is set.

---

## 2. One-time: secret so the Action can add issues to the board

The workflow needs a token with **project** scope. The default `GITHUB_TOKEN` in Actions does not have it, so you must add a **Personal Access Token (PAT)** as a repository secret.

### Steps

1. **Create a PAT** (classic or fine-grained):
   - GitHub → **Settings** → **Developer settings** → **Personal access tokens**
   - Create a token with scope **`project`** (full control of projects).
   - For fine-grained: repo access to `mvp-factory-control`, and **Projects: Read and write**.

2. **Add it as a repository secret:**
   - Open [mvp-factory-control](https://github.com/moldovancsaba/mvp-factory-control) → **Settings** → **Secrets and variables** → **Actions**
   - **New repository secret**
   - Name: **`MVP_PROJECT_TOKEN`**
   - Value: the PAT you created.

3. **Verify:** Open a new issue in the repo. After the workflow runs, the issue should appear on the [board](https://github.com/users/moldovancsaba/projects/1). If the secret is missing, the workflow logs a warning and does not fail the run.

---

## 3. Board fields (Status, Agent, Product, Type, Priority)

The **board** holds workflow state and assignment; the **repo** holds the issue content (title, body, labels).

- **To update board fields:** Use the [GitHub UI](https://github.com/users/moldovancsaba/projects/1) (open the card → edit fields) or the script:  
  `./scripts/mvp-factory-set-project-fields.sh ISSUE_NUMBER --agent Name --status Ready`  
  See [SETUP.md](SETUP.md) (one-time `gh` auth) and [RULES.md](RULES.md).
- **To update issue content:** Edit the issue in the repo (title, body, labels, etc.) as usual.

No automation overwrites existing board fields when adding a new issue; you set Agent, Product, Status, etc. after the card is on the board (or use the script).

---

## 4. Keeping the repo itself up to date

- **Code and docs:** Commit and push changes from your machine (or from an agent run) so that [github.com/moldovancsaba/mvp-factory-control](https://github.com/moldovancsaba/mvp-factory-control) reflects the latest scripts, [docs/RULES.md](RULES.md), [docs/SETUP.md](SETUP.md), and README.
- **Branches:** Use `main` (or your chosen default) and push to `origin` so the GitHub view is current.
- **Issues:** Create and manage them in this repo; the workflow adds new ones to the board. Updates to issue title/body are already in the repo; board fields are updated via UI or script.

---

## Summary

| Goal | How |
|------|-----|
| **Board has every new issue as a card** | Action adds issues on `issues.opened`. Set **MVP_PROJECT_TOKEN** secret (PAT with project scope) once. |
| **Board fields up to date** | Use UI or `./scripts/mvp-factory-set-project-fields.sh`; follow [RULES.md](RULES.md) (no overwrite). |
| **Repo content up to date** | Commit and push changes; create/update issues in the repo. |

After **MVP_PROJECT_TOKEN** is set, creating issues in the repo keeps the board in sync; using the script or UI keeps board fields correct without overwriting other agents.
