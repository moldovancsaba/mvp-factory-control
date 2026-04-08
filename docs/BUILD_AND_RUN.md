# Build And Run: Day-to-Day Operations

The MVP Factory is designed to be managed through the **Control Tray App**.

For Checklist specifically, the local AI runtime is:

- Ollama
- the Checklist local AI worker
- the worker's explicit research phase
- `mvp-factory-control` supervision

## Daily Workflow

1. **Launch the Control App**:
   ```bash
   bash scripts/launch.sh
   ```
   *Note: This script ensures the tray app is always running the latest code from the repository.*
2. **Start the core local services**: Use the tray app to launch Ollama, Paperclip, and the Checklist local AI worker.
3. **Research mode**: The control plane enables Checklist research explicitly. The worker remains functional if public research is unavailable, but health output should still show the research configuration when enabled.
4. **Open Dashboard**: Select "🌐 Open Dashboard" to access `http://localhost:3100`.
5. **Implementation**:
   - Tasks arrive as GitHub Issues in `mvp-factory-control`.
   - Local services are supervised by `mvp-factory-control`.
   - All results and progress are reported back to the original issue.

## Manual Troubleshooting

If a service shows red (🔴) in the tray app and won't start:

### 1. Check Logs
Logs for each service are stored in `/tmp/`:
```bash
tail -f /tmp/control-mvp-paperclip.log
tail -f /tmp/control-checklistsync.log
```

### 2. Manual CLI Control
You can always fall back to the CLI for deep debugging:
- **Docker**: `docker compose up -d`
- **Control App**: `npm run dev` in `apps/mvp-factory-control`
- **Ollama models**: `curl http://127.0.0.1:11434/api/tags`
- **Checklist worker health**: `curl http://127.0.0.1:10005/health`
- **Checklist research refresh**: inspect `researchEnabled`, `researchProvider`, and fact-check settings in the worker health output

<br/>

## 🛠️ Clean Slate: Nuclear Purge

If you encounter ghost companies, corrupted task histories, or simply want to reset your environment for a new industrial delivery, use the **Nuclear Purge**.

### 1. Identify the Target
List all active companies to find the ID or prefix:
```bash
pnpm paperclipai company list
```

### 2. Execute the Purge
Run the definitive purge command (requires confirmation):
```bash
pnpm paperclipai company purge <ID_OR_PREFIX> --yes --confirm <ID_OR_PREFIX>
```

This command perform a single atomic transaction that:
- Wipes **all 44+ related DB tables**.
- Recursively deletes **filesystem agent/project assets**.
- Purges associated **storage objects**.

---

## Re-Bootstrapping / Restoring
If you quit the app or encounter environment issues, simply run:
```bash
bash scripts/launch.sh
```
Or for a full clean install:
```bash
bash scripts/bootstrap.sh
```

For a full technical overview of how the systems interconnect, see [docs/ARCHITECTURE.md](ARCHITECTURE.md).
