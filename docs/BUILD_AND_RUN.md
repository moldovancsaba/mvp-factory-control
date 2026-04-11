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
4. **Open Dashboard**: Select "🌐 Open Dashboard" to open Paperclip at **`https://127.0.0.1:3443/dashboard/`** (default gateway port). The gateway terminates TLS, proxies HTTP/WebSocket to Paperclip on **3100**, and preserves `/dashboard`. Use **`curl --cacert .mvp-factory-control/tls/localhost-cert.pem`** when probing HTTPS from scripts.
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
- **Ollama models** (via gateway): `curl --cacert .mvp-factory-control/tls/localhost-cert.pem -fsS https://127.0.0.1:3443/ollama/api/tags`
- **Checklist worker health** (via gateway): `curl --cacert .mvp-factory-control/tls/localhost-cert.pem -fsS https://127.0.0.1:3443/checklistsync/health`
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

## Internal control app (Next.js) — environment

Run from `apps/mvp-factory-control` (e.g. `npm run dev`). Prisma expects **PostgreSQL** (`DATABASE_URL`).

**Auth (NextAuth)** — optional Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Optional dev login: `MVP_FACTORY_CONTROL_DEV_LOGIN_PASSWORD`, optional `MVP_FACTORY_CONTROL_DEV_LOGIN_EMAIL`.

**GitHub API** — token lookup order (see `src/lib/github.ts`): `MVP_FACTORY_CONTROL_GITHUB_TOKEN`, then `GITHUB_TOKEN`, then `MVP_PROJECT_TOKEN`.

**RBAC** — `MVP_FACTORY_CONTROL_RBAC_ADMIN_EMAILS`, `..._OPERATOR_EMAILS`, `..._VIEWER_EMAILS`, `..._CLIENT_EMAILS` (comma/newline/space separated), and `MVP_FACTORY_CONTROL_RBAC_DEFAULT_ROLE` (default OPERATOR).

**Email ingress** — `MVP_FACTORY_CONTROL_EMAIL_INGRESS_TOKEN`; requests must send the same value in `x-mvp-factory-control-ingress-token` or `Authorization: Bearer ...` (if unset, route allows all — dev only).

**Tool approval** — `MVP_FACTORY_CONTROL_TOOL_APPROVAL_SECRET` (or falls back to `NEXTAUTH_SECRET` in worker JS).

**Dashboard project** — `MVP_FACTORY_CONTROL_DASHBOARD_PRODUCT` (default `mvp-factory-control`).

**Orchestrator lease TTL** — `MVP_FACTORY_CONTROL_ORCHESTRATOR_LEASE_TTL_MS` (default 20000).

**Task retries** — `MVP_FACTORY_CONTROL_TASK_MAX_ATTEMPTS` (default 3, clamped 1–10).

**Local project root (settings file)** — `MVP_FACTORY_CONTROL_LOCAL_PROJECT_ROOT` overrides default `/Users/moldovancsaba/Projects` in `settings-store.ts`.

**Docker CI** — `scripts/mvp-factory-control-docker-portability-gate.sh` uses `MVP_FACTORY_CONTROL_DB_PORT`, `MVP_FACTORY_CONTROL_APP_PORT`, `NEXTAUTH_URL`; GitHub required check name: `portability-gate`.
