# Zero-Config Setup & Deployment (v1.4.1-sovereign)

The MVP Factory is designed to be a high-availability, fully autonomous ecosystem. This guide provides a 100% clear roadmap for installation, including prerequisites and troubleshooting.

**Internal app configuration:** After install, running the Next app from `apps/mvp-factory-control` requires PostgreSQL and the environment variables listed in [BUILD_AND_RUN.md](BUILD_AND_RUN.md) (section **Internal control app — environment**). GitHub CLI project scopes for board scripts are unchanged from the `gh auth refresh` notes below.

## 1. Pre-flight Check (Foundational Requirements)

Before running the installer, ensure your macOS system meets these industry standards:

- **Homebrew**: Required for package management. [Install here](https://brew.sh/).
- **Xcode Command Line Tools**: Required for Git and Python runtimes. Run `xcode-select --install` if not already present.
- **Sibling Repositories**: The Factory Dashboard (`http://localhost:3100`) is served by the `paperclip` repository. 
    - **Strongly Recommended**: Clone `paperclip` into the same parent folder as `mvp-factory-control`.
    - **Control-Only Mode**: If Paperclip is missing, the Control App will still monitor service health, but the board will be unavailable.

## 2. 1-Step Installation

Open your terminal in the `mvp-factory-control` root and run:

```bash
bash scripts/bootstrap.sh
```

If you are installing on a second Mac from a shared path such as `/Volumes/Macintosh HD-1/Users/Shared/Projects`, use the sibling-repo layout described in [docs/TRANSFER_TO_SHARED_MAC.md](TRANSFER_TO_SHARED_MAC.md) and run bootstrap from that copied location.

## 3. Post-Installation Success

Once the installer finishes:

1. **Spotlight Ready**: You can now typed `Control` in Spotlight to launch the Monitoring App.
2. **24/7/365 Sovereign Watchdog**: The background service is now active.
    - > [!IMPORTANT]
    - > **macOS Permission**: Go to `System Settings` -> `General` -> `Login Items` and ensure **"Control"** is allowed to run in the background.
3. **Dashboard Health**: If Paperclip is present, visit [http://localhost:3100](http://localhost:3100) to begin delivery.

---

## 4. Industrial Troubleshooting

| Error/Issue | Root Cause | Resolution |
| :--- | :--- | :--- |
| **🐳 Infrastructure RED (🔴)** | The Docker daemon (Colima) is not running. | Click **"🐳 Docker Infrastructure"** in the tray and select "Start." |
| **All services RED (🔴)** | Docker (Colima) is not running. | Run `colima start` or restart the Control App. |
| **Paperclip RED (🔴)** | Port 3100 is occupied or `paperclip` folder is missing. | Verify `../paperclip` exists and ensure no other process uses port 3100. |
| **Ghost Companies / Corruption** | Residual data from failed deletions. | Use the **Nuclear Purge** (see `docs/BUILD_AND_RUN.md`). |
| **Ollama RED (🔴)** | The host server is crashed. | Click "Start Ollama" in the Control tray and check logs. |
| **Spotlight cant find "Control"** | macOS index latency. | Launch manually once via `bash scripts/launch.sh` or run `mdutil -E /Applications`. |

For the full technical breakdown, see [docs/ARCHITECTURE.md](ARCHITECTURE.md).
