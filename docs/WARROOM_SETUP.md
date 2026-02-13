# War Room (local-first) setup

This is the local War Room webapp that reads/writes the **MVP Factory Board** (GitHub Project 1) and stores chat + telemetry in Postgres.

## 1) Run Docker preflight (required for portability claims)

From `mvp-factory-control/`:

```bash
./scripts/warroom-docker-preflight.sh
```

Interpretation:
- `Preflight result: PASS` means Docker host prerequisites are satisfied.
- `Preflight result: FAIL` means do not continue until remediation steps in output are resolved.

## 2) One-command Docker bootstrap (recommended)

From `mvp-factory-control/`:

```bash
./scripts/warroom-docker-bootstrap.sh
```

What it does:
- runs Docker preflight checks,
- stops existing WarRoom containers and reclaims configured host ports (`WARROOM_DB_PORT`, `WARROOM_APP_PORT`) if occupied,
- starts DB container and waits for healthy status,
- applies Prisma migrations via container,
- starts app container and verifies health + `/signin` reachability.

Post-bootstrap runtime verification (required before claiming healthy delivery):
- check container health:
  - `docker compose ps`
- check app logs for runtime portability errors:
  - `docker logs --tail 200 warroom-app`
- probe key routes:
  - `curl -fsS http://127.0.0.1:${WARROOM_APP_PORT:-3577}/signin >/dev/null`
  - `curl -fsS http://127.0.0.1:${WARROOM_APP_PORT:-3577}/products >/dev/null`
  - `curl -fsS http://127.0.0.1:${WARROOM_APP_PORT:-3577}/agents >/dev/null`

Default host ports are `3579` (DB) and `3577` (app).  
If those ports are occupied by services you want to keep, run with overrides:

```bash
WARROOM_DB_PORT=55432 WARROOM_APP_PORT=3777 NEXTAUTH_URL=http://localhost:3777 ./scripts/warroom-docker-bootstrap.sh
```

## 3) Build WarRoom app image

From `mvp-factory-control/`:

```bash
docker build -f apps/warroom/Dockerfile -t warroom-app:local apps/warroom
```

Expected:
- image builds successfully without embedding secrets from `.env`.
- runtime entrypoint is `npm run start` on port `3007`.
- container health check probes `http://127.0.0.1:3007/signin`.

## 4) Start Docker stack (db + app)

From `mvp-factory-control/`:

```bash
docker compose up -d
```

Health check:

```bash
docker compose ps
```

Expected healthy-state interpretation:
- `warroom-db` => `healthy`
- `warroom-app` => `healthy`

Port collision note:
- defaults are host `3579` for DB and `3577` for app.
- if those ports are already used, override before startup:

```bash
WARROOM_DB_PORT=55432 WARROOM_APP_PORT=3777 NEXTAUTH_URL=http://localhost:3777 docker compose up -d
```

If Docker is not installed on your machine, install Docker Desktop (or Colima) or run Postgres via Homebrew, then set `DATABASE_URL` accordingly.

## 5) Configure env

Create `apps/warroom/.env` using `apps/warroom/.env.example`.

If `DATABASE_URL` is missing, Prisma will fail with:
`Environment variable not found: DATABASE_URL`.

Minimal local example:

```bash
cat > apps/warroom/.env <<'EOF'
NEXTAUTH_URL=http://localhost:3577
NEXTAUTH_SECRET=change-me-please
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
DATABASE_URL=postgresql://warroom:warroom@localhost:3579/warroom?schema=public
WARROOM_GITHUB_TOKEN=
WARROOM_GITHUB_PROJECT_OWNER=moldovancsaba
WARROOM_GITHUB_PROJECT_NUMBER=1
WARROOM_TASK_REPO_OWNER=moldovancsaba
WARROOM_TASK_REPO_NAME=mvp-factory-control
EOF
```

Required:
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (GitHub OAuth app)
- `DATABASE_URL` (matches docker compose)
- `WARROOM_GITHUB_TOKEN` (PAT with ProjectV2 permissions)
- `WARROOM_DASHBOARD_PRODUCT` (default `WarRoom`; dashboard board-card filter)
- `OLLAMA_BASE_URL`, `OLLAMA_MODEL` (for Gwen/local worker)
- `OPENAI_BASE_URL`, `OPENAI_MODEL`, `OPENAI_API_KEY` (for Chappie/cloud worker)

Optional RBAC baseline env (privileged action control):
- `WARROOM_RBAC_ADMIN_EMAILS`
- `WARROOM_RBAC_OPERATOR_EMAILS`
- `WARROOM_RBAC_VIEWER_EMAILS`
- `WARROOM_RBAC_CLIENT_EMAILS`
- `WARROOM_RBAC_DEFAULT_ROLE` (defaults to `OPERATOR` if unset)

RBAC behavior:
- privileged settings/worker-control server actions require role `ADMIN` or `OPERATOR`.
- admin-only override actions require role `ADMIN`.
- denied and allowed privileged checks are recorded in `LifecycleAuditEvent` for audit visibility.

## 6) Init database

From `apps/warroom/`:

```bash
npm run prisma:migrate
```

## 7) Run the app (non-Docker local path)

From `apps/warroom/`:

```bash
npm run dev
```

Open `http://localhost:3577`.

## 8) Start agents

Preferred:
- Open `/agents` in the War Room UI and use `Start Worker` / `Stop Worker`.

CLI fallback:

```bash
# Gwen (local Ollama)
WARROOM_WORKER_AGENT_KEY=Gwen npm run worker

# Chappie (OpenAI)
WARROOM_WORKER_AGENT_KEY=Chappie npm run worker
```

## 9) Validate agent handoff routing (Agent Router v1)

1. In `/chat`, enqueue a task for Gwen with output instructions that include a line:
`@Chappie summarize blockers in 3 lines`
2. Wait for Gwen task completion.
3. Verify in the same thread:
- A SYSTEM message appears: `Routed handoff @Gwen -> @Chappie: ...`
- A new task for `Chappie` is queued and then processed if Chappie worker is running.
4. On `/issues/[number]`, verify recent tasks and thread cards show handoff trace metadata.

## 10) Empty message safety check

1. In `/chat`, click Send with an empty input.
2. In `/issues/[number]`, click Send with an empty input.
3. Expected: no crash/error page; submission is ignored and no blank message is persisted.

If a non-empty message appears to clear without sending, update to latest code:
the mention input now clears only after submit payload capture.

## 11) Mention list quality check

1. Type `@` in `/chat` and `/issues/[number]`.
2. Expected:
- no case-duplicate suggestions like `@gwen` and `@Gwen`.
- only enabled runnable agents (`LOCAL`/`CLOUD`) appear; `MANUAL` agents are hidden.

## 12) Configure settings (recommended)

1. Open `/settings`.
2. Set `Local project folder` to:
`/Users/moldovancsaba/Projects`
3. Configure `Taste rubric (v1, human-owned)` in `/settings`:
- set `version` (for example `v1`)
- set `owner email` (human owner who controls rubric updates)
- define `principles` (one line per principle)
- save with a clear `change reason`
4. Open `/agents` and add per-agent settings:
- `agent-name` (e.g. `Chappie`)
- `agent-url` (e.g. `https://api.openai.com/v1`)
- `agent-model` (e.g. `gpt-4.1-nano`)
- `agent-api-key-env` (e.g. `OPENAI_API_KEY`)
5. Open `/products/<product>` and add per-project settings:
- `project-name`, `project-url`, `project-github`
- optional project vars as `KEY=VALUE` lines
6. Saved settings are persisted to:
`apps/warroom/.warroom/settings.json`

Security note:
- Do not paste raw API keys into settings.
- Keep secrets in `.env` / `.env.local`; store only env var names in settings.

## 13) Bootstrap WarRoom as a tracked project

1. Open `/products`.
2. Click `Add/Refresh WarRoom Project`.
3. Open `/products/WarRoom`.
4. Expected:
- WarRoom project config exists in `.warroom/settings.json`.
- `project-github` is saved as `https://github.com/moldovancsaba/mvp-factory-control.git`.
- Project vars include `APP_PATH`, `ROADMAP_DOC`, `HANDOVER_DOC`, `SETUP_DOC`.
- GitHub Product option sync runs only if `WARROOM_ENABLE_PRODUCT_OPTION_SYNC=1`.
- Without the opt-in flag, WarRoom may remain `Local-only` with config persisted.

## 14) Docker bootstrap troubleshooting

Common failures and remediations:
- `docker: command not found`:
  - install Docker CLI/runtime (for example `brew install docker docker-compose colima`), start daemon (`colima start`), then rerun preflight.
- host port collision (`3579` or `3577` already used):
  - run with port overrides:
    - `WARROOM_DB_PORT=55432 WARROOM_APP_PORT=3777 NEXTAUTH_URL=http://localhost:3777 ./scripts/warroom-docker-bootstrap.sh`
- DB health timeout:
  - inspect DB logs: `docker logs warroom-db`
  - verify container health: `docker compose ps`
- migration failure:
  - rerun migration command:
    - `docker compose run --rm --no-deps warroom-app npx prisma migrate deploy`
  - ensure `DATABASE_URL` and schema reachability are valid.
- app health timeout:
  - inspect app logs: `docker logs warroom-app`
  - verify env keys exist in `apps/warroom/.env` (`NEXTAUTH_*`, `WARROOM_GITHUB_TOKEN`, OAuth keys).
- generic "Server Components render" error on `/agents` in Docker:
  - inspect logs for `ps` portability failures (`bad -o argument 'command'`).
  - ensure runtime uses portable process listing (`ps -eo pid=,args=` path in `src/lib/worker-process.ts`).
- generic "Server Components render" error with `EACCES` and `/app/.warroom`:
  - confirm image sets writable ownership for `/app/.warroom` before `USER nextjs`.
  - rebuild app image and rerun bootstrap.

## 15) Automated Docker portability gate (CI + local)

Workflow:
- `.github/workflows/warroom-docker-portability-gate.yml`

Gate runner script:
- `scripts/warroom-docker-portability-gate.sh`

Portability health rubric/report:
- `docs/WARROOM_DOCKER_PORTABILITY_HEALTH_REPORT.md`

What the automated gate enforces:
- preflight prerequisites pass (`scripts/warroom-docker-preflight.sh`)
- `docker compose -f docker-compose.yml config -q` passes
- bootstrap path passes (`scripts/warroom-docker-bootstrap.sh`)
- expected healthy condition: `warroom-db` and `warroom-app` health are both `healthy`
- expected unhealthy condition: an invalid endpoint probe fails (non-success), confirming gate is not silently permissive

Delivery readiness interpretation:
- Docker portability is considered healthy enough to deliver only when this workflow passes for the change set and the standard app build gate (`npm run build` in `apps/warroom`) also passes.
- if the workflow fails, portability readiness is blocked until remediation and re-run evidence are attached to the issue.
