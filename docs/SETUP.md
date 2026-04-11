# Zero-Config Setup & Deployment (v1.4.1-sovereign)

The MVP Factory is designed to be a high-availability, fully autonomous ecosystem. This guide provides a 100% clear roadmap for installation, including prerequisites and troubleshooting.

**Internal app configuration:** After install, running the Next app from `apps/mvp-factory-control` requires PostgreSQL and the environment variables listed in [BUILD_AND_RUN.md](BUILD_AND_RUN.md) (section **Internal control app — environment**). GitHub Projects CLI setup is in [section 4](#4-github-cli--projects-board) below.

## 1. Pre-flight Check (Foundational Requirements)

Before running the installer, ensure your macOS system meets these industry standards:

- **Homebrew**: Required for package management. [Install here](https://brew.sh/).
- **Xcode Command Line Tools**: Required for Git and Python runtimes. Run `xcode-select --install` if not already present.
- **Sibling Repositories**: The Factory Dashboard (Paperclip) is served from the `paperclip` repository.
    - **Strongly Recommended**: Clone `paperclip` into the same parent folder as `mvp-factory-control`.
    - **Control-Only Mode**: If Paperclip is missing, the Control App will still monitor service health, but the board will be unavailable.
    - **URLs**: Use **HTTPS only** for Paperclip in the browser: **`https://127.0.0.1:<MVP_HTTPS_GATEWAY_PORT>/dashboard/`** (default **3443**). The Control app starts Paperclip with `PAPERCLIP_PUBLIC_BASE_PATH=/dashboard` and keeps the local TLS gateway running. The gateway uses plain HTTP only on the final hop to `127.0.0.1:3100` inside your machine (Paperclip does not speak TLS on that port).

## 2. 1-Step Installation

Open your terminal in the `mvp-factory-control` root and run:

```bash
bash scripts/bootstrap.sh
```

If you are installing on a second Mac from a shared path such as `/Volumes/Macintosh HD-1/Users/Shared/Projects`, use the sibling-repo layout described in [docs/TRANSFER_TO_SHARED_MAC.md](TRANSFER_TO_SHARED_MAC.md) and run bootstrap from that copied location.

## 3. Post-Installation Success

Once the installer finishes:

1. **Spotlight**: You can now type `Control` in Spotlight to launch the Monitoring App.
2. **24/7/365 Sovereign Watchdog**: The background service is now active.
    - > [!IMPORTANT]
    - > **macOS Permission**: Go to `System Settings` -> `General` -> `Login Items` and ensure **"Control"** is allowed to run in the background.
3. **Dashboard Health**: Open Paperclip only via **HTTPS** (Control app **Open Dashboard** or `https://127.0.0.1:3443/dashboard/`). Health: `curl --cacert .mvp-factory-control/tls/localhost-cert.pem -fsS https://127.0.0.1:3443/dashboard/api/health`.

---

## 4. GitHub CLI & Projects board

Scripts such as [`scripts/mvp-factory-set-project-fields.sh`](../scripts/mvp-factory-set-project-fields.sh) and [`scripts/list-project-column.sh`](../scripts/list-project-column.sh) call the GitHub Projects API. Your token needs **`read:project`** and **`project`** scopes.

### Add scopes (active account only)

`gh auth refresh` always updates the **currently active** `github.com` login. It does **not** accept `-u` to pick a user.

1. See which account is active: `gh auth status`
2. Switch if needed: `gh auth switch -h github.com -u YOUR_LOGIN`
3. Refresh scopes: `gh auth refresh -h github.com -s read:project,project`  
   (This may open [https://github.com/login/device](https://github.com/login/device); complete the flow in the browser.)

Afterward, confirm with `gh auth status` that `read:project` and `project` appear for that account.

### Status column names (project 1)

There is **no** Status value named `Ready` on the current board. The **Status** single-select options include **Todo (NEXT)** (typical “next up” queue), **In Progress (NOW)**, **Backlog (SOONER)**, **Done**, and others.

- List every Status option: `bash scripts/list-project-column.sh`
- List items in one status (quote values with spaces):  
  `bash scripts/list-project-column.sh 'Todo (NEXT)'`

Project URL: [github.com/users/moldovancsaba/projects/1](https://github.com/users/moldovancsaba/projects/1).

### Board status shortcuts

[`mvp-factory-set-project-fields.sh`](../scripts/mvp-factory-set-project-fields.sh) accepts these **case-insensitive** shortcuts for `--status` / `MVP_STATUS` so older playbooks and external wrappers keep working:

| You pass | Board value used |
| :--- | :--- |
| `Backlog` | `Backlog (SOONER)` |
| `Ready` | `Todo (NEXT)` |
| `Roadmap` | `Roadmap (LATER)` |
| `In Progress` | `In Progress (NOW)` |

**Everything else** (the GitHub CLI, `gh project item-list --query`, other repos’ automation) must use the **exact** option string. Discover current names from this repo with `bash scripts/list-project-column.sh` (from the `mvp-factory-control` root).

---

## 5. Industrial Troubleshooting

| Error/Issue | Root Cause | Resolution |
| :--- | :--- | :--- |
| **🐳 Infrastructure RED (🔴)** | The Docker daemon (Colima) is not running. | Click **"🐳 Docker Infrastructure"** in the tray and select "Start." |
| **All services RED (🔴)** | Docker (Colima) is not running. | Run `colima start` or restart the Control App. |
| **Paperclip RED (🔴)** | Port 3100 is occupied or `paperclip` folder is missing. | Verify `../paperclip` exists and ensure no other process uses port 3100. |
| **Ghost Companies / Corruption** | Residual data from failed deletions. | Use the **Nuclear Purge** (see `docs/BUILD_AND_RUN.md`). |
| **Ollama RED (🔴)** | The host server is crashed. | Click "Start Ollama" in the Control tray and check logs. |
| **Spotlight cant find "Control"** | macOS index latency. | Launch manually once via `bash scripts/launch.sh` or run `mdutil -E /Applications`. |

For the full technical breakdown, see [docs/ARCHITECTURE.md](ARCHITECTURE.md).
