# WAR ROOM HANDOVER (Operational Continuation Pack)

Last updated: 2026-02-13
Owner: Sultan (Product Owner) + War Room agent team
Primary repo: `mvp-factory-control`
Primary app: `apps/warroom`

## 1) Mission and execution discipline

Mission:
- run a local-first WarRoom where human intent, agent execution, and audit evidence stay aligned.

Execution discipline:
- board is SSOT for work state.
- all new ideas are captured first in `IDEA BANK` before roadmap/backlog triage.
- work starts only from `Ready` cards with valid prompt package.
- board fields and issue evidence are updated after each meaningful execution step.
- docs must reflect current truth in the same work window.

Context discipline:
- treat continuation context as near 70% by default.
- before substantial implementation, refresh handover/status/doctrine docs.

## 2) Current operational baseline (implemented)

Implemented and live in code:
- `#76` queue hardening (retry/backoff/dead-letter)
- `#77` access control baseline (RBAC) for privileged settings/worker controls
- `#78` orchestrator hard lease lock + lease-gated lifecycle writes
- `#79` permission matrix + lifecycle state machine + `LifecycleAuditEvent`
- `#80` judgement policy gates with structured go/no-go audit evidence
- `#81` taste rubric v1 with human-owner governance and task/audit version linkage
- `#82` email-only external ingress (`/api/ingress/email`) with authz/normalization/retry/dead-letter visibility
- `#88` Alpha/Beta role model enforcement (`Agent.controlRole`)
- `#89` single active Alpha context window per product lock
- `#90` context guardrail + mandatory handover package refs
- `#95` standard Alpha handover artifact spec + validation
- `#96` orchestrator state introspection endpoint/UI
- `#97` failure taxonomy + safe fallback rules
- `#98`, `#99` agent identity reconciliation hardening
- `#102` executable prompt package gate enforcement across board/runtime
- `#111` Docker portability preflight contract (daemon/tooling gate)
- `#112` app containerization (Dockerfile + runtime validation)
- `#113` full compose stack + container health model
- `#114` one-command Docker bootstrap (migrate + start + verify)
- `#115` automated Docker portability gate (compose + health checks)
- `#116` portable Docker operating baseline umbrella + health rubric/report
- `#117` dashboard product scoping + source-correct error reporting
- `#75` runtime scoped settings umbrella closed (`Done`) after delivered child items `#93` + `#94`

Current execution lane (board as-of 2026-02-13):
- `In Progress`: (none)
- `Ready`: (none)
- `Backlog`: `#133`, `#134`, `#135`, `#136`, `#137`, `#138`
- `Done`: `#131`, `#132`, `#75`, `#144`

Current `IDEA BANK` items (board as-of 2026-02-13):
- `#118` policy simulation and replay harness for governance changes
- `#119` board-runtime drift sentinel and safe block policy
- `#120` recovery readiness drills and incident evidence bundle
- `#121` continuous tech-intelligence ingestion agent
- `#122` fit-analysis agent for discovered technologies
- `#123` policy-gated auto-onboarding pipeline for approved new agents
- `#124` continuous A/B/C/D benchmark and routing optimization for agents
- `#125` agent capability registry and compatibility matrix
- `#126` compliance and safety gate for external agent/tool adoption
- `#127` canary rollout framework for newly onboarded agents
- `#128` benchmark dataset governance for reproducible A/B/C/D evaluation
- `#129` cost-aware routing policy (quality/latency/spend tradeoff)
- `#139` task cancel/interrupt/resume semantics
- `#140` secrets/DLP guardrail for terminal/file/chat output
- `#141` execution identity/provenance chain
- `#142` tool-runtime SLO dashboard
- `#143` ephemeral workspace provisioning and cleanup policy

Active delivery kickoff (current window):
- preflight dependency root `#111` is delivered (`Done`).
- app containerization `#112` is delivered (`Done`) with validated image build + runtime checks.
- `#113` full compose stack is delivered (`Done`) with db+app health checks and dependency ordering.
- `#114` one-command bootstrap is delivered (`Done`) with migration + health verification.
- `#115` portability gate is delivered (`Done`) with local gate pass evidence (`scripts/warroom-docker-portability-gate.sh`) and build pass (`npm run build`).
- `#116` dependency umbrella is delivered (`Done`) with final portability health report artifact:
  - `docs/WARROOM_DOCKER_PORTABILITY_HEALTH_REPORT.md`
- `#103` readiness retrofit is delivered (`Done`): `#77`, `#80`, `#81`, `#91`, `#93`, `#94` now carry valid prompt packages and are promoted to `Ready`.
- `#77` RBAC baseline is delivered (`Done`) with role-model enforcement + lifecycle audit logging for privileged settings/worker actions.
- `#80` judgement policy gates are delivered (`Done`) with deterministic policy evaluator and per-task audit evidence persistence.
- `#81` taste rubric v1 is delivered (`Done`) with versioned config, owner-controlled updates, and audit-visible version references.
- `#117` dashboard product scoping + source-correct error reporting is delivered (`Done`).
- `#91` prompt/package invariants registry is delivered (`Done`) with immutable task/context package registries, lineage query surfaces, and build pass evidence.
- `#93` runtime config ingestion is delivered (`Done`) with deterministic project/context resolution, source-chain digesting, and execution audit logging.
- `#94` runtime mutability policy is delivered (`Done`) with write-time/runtime-load enforcement and mutable/denied mutation audit events.
- launch-enablement chain for dev-operator cockpit is created:
  - roadmap umbrella `#130`
  - `Done`: `#131`, `#132`
  - `Backlog`: `#133`, `#134`, `#135`, `#136`, `#137`, `#138`
  - locked order from next execution: `#136 -> #133 -> (#134 + #137) -> #135 -> #138`
- prompt package validator pass evidence confirmed for `#130` -> `#138`.
- `#131` is delivered (`Done`) with acceptance evidence comment and build gate pass (`cd apps/warroom && npm run build`).
- `#132` is delivered (`Done`) with policy/approval gates + replay/expiry/fingerprint enforcement and build pass (`cd apps/warroom && npm run build`).
- runtime settings umbrella `#75` is closed (`Done`) with closure evidence linked to delivered children `#93` + `#94`.
- context-pressure checkpoint: continuation context is treated as near 70%; scope expansion remains bounded to ordered execution with handover-first updates.

New dependency-ordered backlog initiative:
- Docker portability delivery chain (`#111` -> `#116`) was added to close the bring-anywhere runtime gap.

## 3) Architecture truth (current)

System SSOT split:
- portfolio/workflow state: GitHub Project 1 (`MVP Factory Board`)
- runtime/transcripts/queue state: local Postgres via Prisma

Core control model:
- orchestrator lease is the single control authority path for lifecycle writes.
- Alpha role is required for control-plane worker authority.
- Beta role is execution-only; control-boundary violations are denied and audited.

Queue and lifecycle behavior:
- task statuses include `MANUAL_REQUIRED` and `DEAD_LETTER`.
- retries/backoff/dead-letter are deterministic and auditable.
- unsafe paths degrade to manual-required, not silent execution.

Context and continuity:
- one active Alpha context window per product.
- guardrail warning/block thresholds enforce handover package discipline.
- handover artifacts are validated against v1 spec before acceptance.

## 4) Known limits (intentional for MVP)

- RBAC baseline is delivered (`#77`); expanded RBAC scope can evolve in later governance phases.
- judgement policy objects and taste rubric baseline are formalized (`#80`, `#81` done).
- runtime config governance artifacts are delivered (`#93`, `#94` done).
- dev-operator cockpit runtime capabilities (terminal/filesystem/git/PR/evidence) are now tracked in launch chain `#130` -> `#138`.
- external ingress remains email-only by design.
- Docker portability chain is delivered end-to-end (`#111` -> `#116`).

## 5) Environment requirements (no secret values)

Required:
- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `WARROOM_GITHUB_TOKEN`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

Common runtime defaults:
- local/ollama: `OLLAMA_BASE_URL`, `OLLAMA_MODEL`
- cloud/openai-compatible: `OPENAI_BASE_URL`, `OPENAI_MODEL`, `OPENAI_API_KEY`

Worker controls:
- `WARROOM_WORKER_AGENT_KEY`
- `WARROOM_WORKER_POLL_MS`
- `WARROOM_WORKER_MODEL`
- `WARROOM_WORKER_HOST`
- `WARROOM_TASK_MAX_ATTEMPTS`
- `WARROOM_TASK_RETRY_BASE_MS`
- `WARROOM_TASK_RETRY_MAX_MS`
- `WARROOM_TASK_RETRY_JITTER_MS`
- `WARROOM_WORKER_REQUEST_TIMEOUT_MS`
- `WARROOM_ORCHESTRATOR_LEASE_ID`
- `WARROOM_ORCHESTRATOR_LEASE_TTL_MS`
- `WARROOM_ORCHESTRATOR_STALE_RUNNING_MS`

Email ingress controls:
- `WARROOM_EMAIL_INGRESS_TOKEN`
- `WARROOM_EMAIL_TRUSTED_SENDERS`
- `WARROOM_EMAIL_BLOCKED_SENDERS`
- `WARROOM_EMAIL_REQUIRE_TRUSTED`
- `WARROOM_EMAIL_RETRY_MAX_ATTEMPTS`
- `WARROOM_EMAIL_RETRY_BASE_MS`
- `WARROOM_EMAIL_RETRY_MAX_MS`

## 6) Local runbook

1. Start app:
```bash
cd /Users/moldovancsaba/Projects/mvp-factory-control/apps/warroom
npm run dev
```

2. Open UI:
- `http://localhost:3007`

3. Configure agent on `/agents`:
- runtime `LOCAL` or `CLOUD`
- URL/model/API env var where needed
- smoke pass true
- readiness `READY`

4. Start worker from `/agents` or CLI:
```bash
cd /Users/moldovancsaba/Projects/mvp-factory-control/apps/warroom
WARROOM_WORKER_AGENT_KEY=Gwen npm run worker
```

5. Validate on `/chat`:
- send `@Agent say hello`
- expect queued -> running -> done with transcript evidence

## 7) Mandatory validation gates

Before/after implementation windows:
1. Build gate:
```bash
cd /Users/moldovancsaba/Projects/mvp-factory-control/apps/warroom
npm run build
```

2. Prompt package gate before selecting next issue:
```bash
cd /Users/moldovancsaba/Projects/mvp-factory-control
node scripts/mvp-factory-validate-prompt-package.js --issue <ISSUE_NUMBER> --repo moldovancsaba/mvp-factory-control
```

3. Board sync gate after each meaningful step:
- set status/fields accurately,
- post concise issue evidence,
- move completed work to `Done` in the same work window.

## 8) Board commands (live truth)

List WarRoom cards and statuses:
```bash
cd /Users/moldovancsaba/Projects/mvp-factory-control
gh issue list --state all --limit 400 --json number,title,projectItems \
  | jq -r '.[] | {n:.number,t:.title,s:(.projectItems[]?.status.name // "(none)")} | select(.t|contains("WarRoom")) | "#\(.n)\t\(.s)\t\(.t)"'
```

List Ready cards only:
```bash
cd /Users/moldovancsaba/Projects/mvp-factory-control
gh issue list --state all --limit 400 --json number,title,projectItems \
  | jq -r '.[] | {n:.number,t:.title,s:(.projectItems[]?.status.name // "(none)")} | select(.s=="Ready") | "#\(.n)\t\(.t)"'
```

## 9) Key files for continuation

Core app:
- `apps/warroom/src/app/dashboard/page.tsx`
- `apps/warroom/src/app/products/page.tsx`

## 10) Incident Ledger (Latest)

### 2026-02-13: Docker runtime regression set (`#144`)

Status:
- `#144` is closed (`Done`) with board evidence comments and docs/runbook updates in the same work window.

Symptoms observed:
- `/signin` and server-rendered routes failed with generic Server Components error in production container mode.
- `/agents` failed in container while `/products` remained functional.

Root causes:
1. Runtime write-path permission gap:
- app attempted to create `/app/.warroom` as non-root runtime user, but directory ownership did not allow writes in container image.
2. Process listing portability gap:
- `/agents` worker process discovery used `ps -Ao pid=,command=`, which is unsupported in Alpine/BusyBox `ps`.

Fixes delivered:
- Docker runtime ownership fix in `apps/warroom/Dockerfile`:
  - create `/app/.warroom/worker-logs`
  - `chown -R nextjs:nodejs /app` before dropping to `USER nextjs`
- Portable worker process listing fix in `apps/warroom/src/lib/worker-process.ts`:
  - replace `ps -Ao pid=,command=` with `ps -eo pid=,args=`
  - safe fallback to empty list on process-command failure.
- Dedicated default ports + bootstrap resilience:
  - default app/db host ports set to `3577`/`3579`
  - bootstrap port reclaim logic for occupied configured ports.

Verification evidence:
- `./scripts/warroom-docker-bootstrap.sh` PASS on `3577`/`3579`.
- `docker compose ps` shows healthy `warroom-app` and `warroom-db`.
- `docker logs warroom-app` no longer shows:
  - `EACCES: permission denied, mkdir '/app/.warroom'`
  - `ps: bad -o argument 'command'`.
- route checks:
  - `/signin` reachable
  - `/agents` renders in container mode.

Prevention rules (mandatory going forward):
- Any Docker/runtime incident must be logged on board with RCA + exact command evidence in same work window.
- Portability verification for runtime-affecting changes must include:
  - `docker compose ps`
  - `docker logs --tail 200 warroom-app`
  - route probes for `/signin`, `/products`, and `/agents`.
- No issue can be considered done until handover/status docs include the incident snapshot.
- `apps/warroom/src/app/agents/page.tsx`
- `apps/warroom/src/app/chat/page.tsx`
- `apps/warroom/src/app/issues/[number]/page.tsx`

Server actions:
- `apps/warroom/src/app/chat/actions.ts`
- `apps/warroom/src/app/issues/[number]/actions.ts`
- `apps/warroom/src/app/agents/actions.ts`
- `apps/warroom/src/app/products/actions.ts`

Core libs:
- `apps/warroom/src/lib/tasks.ts`
- `apps/warroom/src/lib/worker-process.ts`
- `apps/warroom/src/lib/agent-readiness.ts`
- `apps/warroom/src/lib/orchestrator-introspection.ts`
- `apps/warroom/src/lib/alpha-failure-policy.ts`
- `apps/warroom/src/lib/handover-package.ts`

Schema:
- `apps/warroom/prisma/schema.prisma`

Doctrine:
- `docs/WARROOM_WHY_AND_HOW.md`
- `docs/WARROOM_MANIFESTO.md`
- `docs/WARROOM_DELIVERY_STORY.md`
- `docs/WARROOM_MVP_SPINE_AND_BACKLOG.md`
- `docs/WARROOM_DOCKER_PORTABILITY_HEALTH_REPORT.md`

## 10) Safety rules for next window

- never expose secrets in code/docs/logs/UI.
- do not revert unrelated local changes.
- keep changes additive and reversible.
- validate build after implementation changes.
- keep board and docs synchronized in the same execution window.

## 11) Ready-to-paste continuation prompt

```text
Continue work in /Users/moldovancsaba/Projects/mvp-factory-control.
Context guardrail:
- Treat context as near 70% from start.
- Handover-first always (update handover/status docs before coding each issue).

Read first:
1) /Users/moldovancsaba/Projects/mvp-factory-control/docs/WARROOM_HANDOVER.md
2) /Users/moldovancsaba/Projects/mvp-factory-control/docs/WARROOM_STATUS_BRAINDUMP.md
3) /Users/moldovancsaba/Projects/mvp-factory-control/docs/WARROOM_MVP_SPINE_AND_BACKLOG.md
4) /Users/moldovancsaba/Projects/mvp-factory-control/docs/WARROOM_WHY_AND_HOW.md
5) /Users/moldovancsaba/Projects/mvp-factory-control/docs/WARROOM_MANIFESTO.md
6) /Users/moldovancsaba/Projects/mvp-factory-control/docs/WARROOM_DELIVERY_STORY.md

Constraints:
- Board is SSOT. Keep board fields + issue evidence updated after each meaningful step.
- Do not start implementation unless selected issue is in Ready and prompt package validates.
- Preserve lease/role/lifecycle/email-ingress safety invariants.
- No secrets in output/logs/UI.
- Additive/reversible changes only; do not revert unrelated local changes.

Current launch lane:
- #130 Roadmap (Type=Plan umbrella only).
- #131 Done (P0), closed.
- #132 Done (P0), closed.
- #136 Backlog (P0) and next executable item candidate.
- Backlog chain: #136 (P0) -> #133 (P0) -> (#134 + #137) -> #135 (P1) -> #138 (P1).
- Locked order: #136 -> #133 -> (#134 + #137) -> #135 -> #138.

Per-issue execution loop:
1) Confirm board status is Ready.
2) Validate prompt package:
   node /Users/moldovancsaba/Projects/mvp-factory-control/scripts/mvp-factory-validate-prompt-package.js --issue <ISSUE_NUMBER> --repo moldovancsaba/mvp-factory-control
3) Handover-first updates:
   - /Users/moldovancsaba/Projects/mvp-factory-control/docs/WARROOM_HANDOVER.md
   - /Users/moldovancsaba/Projects/mvp-factory-control/docs/WARROOM_STATUS_BRAINDUMP.md
4) Move issue to In Progress and post start comment.
5) Implement scope with invariants intact.
6) Validate build:
   cd /Users/moldovancsaba/Projects/mvp-factory-control/apps/warroom && npm run build
7) Post concise acceptance evidence comment.
8) Move issue to Done.
9) Refresh handover/status/backlog snapshot before next issue.

Next action:
- Promote #136 to Ready (after prompt-package revalidation) and execute next.
- Keep locked order for remaining launch chain (#136 -> #133 -> (#134 + #137) -> #135 -> #138).
- If context pressure rises again, stop scope expansion and refresh handover/status before continuing.
```
