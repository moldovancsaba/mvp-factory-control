# MVP Factory War Room - Status + Brain Dump

Last updated: 2026-02-18
Scope: `apps/warroom`

## 1) Executive status

WarRoom control-plane MVP is operational with hard safety gates active.

Live baseline delivered:
- queue reliability hardening (`#76`)
- orchestrator hard lease lock (`#78`)
- lifecycle policy/audit matrix (`#79`)
- email-only ingress boundary (`#82`)
- Alpha/Beta control-role enforcement (`#88`)
- single active Alpha context lock per product (`#89`)
- context guardrail + mandatory handover package refs (`#90`)
- handover artifact spec + validator (`#95`)
- orchestrator introspection surface (`#96`)
- failure taxonomy + safe fallback policy (`#97`)
- agent identity reconciliation + Ready gate enforcement (`#98`, `#99`, `#102`)

Current WarRoom board posture (as-of 2026-02-18):
- IDEA BANK: 11
- Roadmap: 5
- Backlog: 3
- Ready: 0
- In Progress: 0
- Done: 54

Current delivery focus:
- `#111` Docker portability preflight contract is delivered.
- `#112` app runtime containerization is delivered (Docker runtime validated + image/runtime checks passed).
- `#113` full compose stack + health model is delivered.
- `#114` bootstrap/migrate/verify path is delivered.
- `#115` automated portability gate is delivered with acceptance evidence (gate script + CI workflow + docs semantics + validation pass).
- `#116` umbrella baseline issue is delivered with final health rubric/report and linked dependency evidence.
- `#103` is delivered (`Done`): executable prompt packages retrofitted for highest-priority backlog cohort and promoted to `Ready`.
- `#77` RBAC baseline is delivered (`Done`) with centralized role guards and privileged-action audit logging.
- `#80` judgement policy gates are delivered (`Done`) with deterministic evaluator + per-task audit persistence.
- `#81` taste rubric v1 is delivered (`Done`) with owner-governed versioned rubric config and task/audit rubric references.
- `#117` dashboard bugfix is delivered (`Done`): Product-scoped dashboard view + source-correct board/local error handling.
- `#91` prompt/package invariants registry is delivered (`Done`) with immutable task/context registries, lineage query support, and build gate pass.
- `#93` runtime config ingestion is delivered (`Done`) with deterministic project/context resolution, source-chain digesting, and execution audit logging.
- `#94` runtime mutability policy is delivered (`Done`) with immutable/mutable write enforcement, runtime-load policy enforcement, and mutation audit events.
- launch-enablement planning from gap audit is now on board:
  - umbrella `#130` delivered (`Done`) with dependency-chain closure evidence
  - `#131` delivered (`Done`) with acceptance evidence + build pass
  - `#132` delivered (`Done`) with policy/approval gate evidence + build pass
  - `#136` delivered (`Done`) with workspace-bounded filesystem tools, traversal/symlink protections, binary policy checks, and policy-gated mutation execution
  - `#133` delivered (`Done`) with sandboxed shell runtime, policy-gated execution path, and deterministic timeout/cancel/error lifecycle handling
  - `#134` delivered (`Done`) with streamed shell output to issue thread and redacted/bounded artifact persistence
  - `#137` delivered (`Done`) with runtime issue-evidence posting to GitHub + idempotent/audited lifecycle integration
  - `#135` delivered (`Done`) with policy-safe git runtime operations and protected-branch mutation safeguards
  - `#138` delivered (`Done`) with launch rehearsal report and GO decision
  - locked order: `#133 -> (#134 + #137) -> #135 -> #138`
- post-MVP hardening queue prepared in Ready:
  - (none remaining)
- OpenClaw-inspired WarRoom hardening intake is now tracked in Backlog:
  - `#204` channel-aware provenance model for ingress identity (Feature, P1)
  - `#205` secure memory index + retrieval controls (Feature, P1)
  - `#206` omnichannel routing + human-gated NBA orchestration (Feature, P1)
- `#203` is delivered (`Done`) with:
  - explicit `HUMAN_APPROVAL` declaration enforcement for approval-required call classes
  - expanded shell denylist signatures with deterministic rule-id reasons
  - new security-policy baseline harness + CI gate
- `#139` is delivered (`Done`) with:
  - operator task-session controls (`interrupt`, `cancel`, `resume`) on issue task cards
  - lifecycle policy transitions for `CANCEL_TASK` / `INTERRUPT_TASK` / `RESUME_TASK`
  - worker idempotent cancel handling and interrupt-aware runtime evidence
- `#140` is delivered (`Done`) with:
  - deterministic DLP mode support (`OFF|REDACT|DENY`) for runtime outputs
  - output filtering before chat persistence / issue-evidence publication
  - audit-visible `DLP_OUTPUT_FILTER` traces (mode/action/ruleIds/matchCount)
  - DLP regression harness + CI gate wiring
- `#146` is delivered (`Done`) with:
  - deterministic filesystem safety harness (`apps/warroom/scripts/e2e/warroom-filesystem-safety.e2e.js`)
  - CI gate wiring (`.github/workflows/warroom-filesystem-safety-gate.yml`)
  - policy and guardrail assertions for traversal/symlink/binary/approval invariants from `#136`
- `#145` is delivered (`Done`) with:
  - portability gate parity defaults aligned to `3579/3577`
  - route-level regression checks (`/signin`, `/products`, `/agents`)
  - runtime regression-signature log checks (`EACCES /app/.warroom`, non-portable `ps` signature)
  - docs/workflow contract alignment (`WARROOM_SETUP.md`, `WARROOM_DOCKER_PORTABILITY_HEALTH_REPORT.md`, portability gate workflow)
- `#119` is delivered (`Done`) with:
  - board/runtime drift sentinel before task execution (`BLOCK_TASK_ON_DRIFT` gate)
  - safe downgrade path (`RUNNING -> MANUAL_REQUIRED`) with deterministic remediation guidance
  - audit-visible drift diagnostics and runtime issue-evidence publication for blocked tasks
  - dashboard diagnostics panel sourced from `LifecycleAuditEvent(action=BLOCK_TASK_ON_DRIFT)`
- `#141` is delivered (`Done`) with:
  - deterministic provenance chain registration at task enqueue (`TASK_PROVENANCE/REGISTER_PROVENANCE_CHAIN`)
  - approver binding to chain during approval verification (`TASK_PROVENANCE/BIND_APPROVER_TO_CHAIN`)
  - git artifact lineage emission (`TASK_PROVENANCE/EMIT_GIT_ARTIFACT`) with branch/commit/pr references
  - dashboard `Execution provenance chain` surface with recent lineage events
- `#142` is delivered (`Done`) with:
  - dashboard `Tool-runtime SLOs (last 7 days)` section
  - task latency p50/p95, terminal outcome/failure/dead-letter rates
  - approval wait p50/p95 and DLP redacted/blocked summary
  - threshold-based alert hints with remediation guidance
- `#120` is delivered (`Done`) with:
  - deterministic recovery readiness harness (backup integrity + isolated restore drill + rubric checks)
  - redacted incident evidence bundle generator + schema (`incident-bundle.schema.json`)
  - recurring CI recovery readiness gate workflow
  - recovery readiness runbook and operator checklist
- baseline e2e harness is now available and passing:
  - script: `apps/warroom/scripts/e2e/warroom-postmvp.e2e.js`
  - command: `cd apps/warroom && npm run e2e:warroom`
  - latest run id: `warroom-e2e-2026-02-18T10:14:13.515Z` (PASS)
- security-policy baseline harness is available and passing:
  - script: `apps/warroom/scripts/e2e/warroom-security-policy-baseline.e2e.js`
  - command: `cd apps/warroom && npm run e2e:security-policy`
  - latest run id: `warroom-security-policy-baseline-e2e-2026-02-18T10:14:05.579Z` (PASS)
- prompt package validator pass confirmed for launch cards `#130`-`#138`.
- runtime umbrella `#75` is now closed (`Done`) with evidence linked to delivered child issues `#93` + `#94`.
- additional foundation ideas in `IDEA BANK`: `#118`, `#121`-`#129`, and `#143`.
- new idea intake lane is active: all speculative and emerging WarRoom ideas now enter `IDEA BANK` first before roadmap/backlog triage.
- active executable item: (none; next promotion required from Backlog to Ready)

Next triage priorities (promote 1 to `Ready` before implementation):
- `#204` channel-aware provenance model for ingress identity (P1; extends existing provenance chain for multi-channel input paths).
- `#205` secure memory index + retrieval controls (P1; introduces bounded retrieval + audit-visible policy checks).
- `#206` omnichannel routing + human-gated NBA orchestration (P1; queue after #204/#205).

De-dupe update (completed):
- duplicate cards `#148`/`#149`/`#150`/`#151`/`#152` are now closed and project-status set to `Done` with triage rationale comments linking canonical cards.

Current active next-card preflight:
- selected next card candidate: `#204` (pending prompt package validation + status promotion to `Ready`)
- `#119` completion evidence captured:
  - start comment: `https://github.com/moldovancsaba/mvp-factory-control/issues/119#issuecomment-3919375249`
  - acceptance comment: `https://github.com/moldovancsaba/mvp-factory-control/issues/119#issuecomment-3919394770`
  - board status moved to `Done`, issue closed
- `#141` completion evidence captured:
  - start comment: `https://github.com/moldovancsaba/mvp-factory-control/issues/141#issuecomment-3919414439`
  - acceptance comment: `https://github.com/moldovancsaba/mvp-factory-control/issues/141#issuecomment-3919431384`
  - board status moved to `Done`, issue closed
- `#142` completion evidence captured:
  - start comment: `https://github.com/moldovancsaba/mvp-factory-control/issues/142#issuecomment-3919448951`
  - acceptance comment: `https://github.com/moldovancsaba/mvp-factory-control/issues/142#issuecomment-3919460509`
  - board status moved to `Done`, issue closed
- `#120` completion evidence captured:
  - start comment: `https://github.com/moldovancsaba/mvp-factory-control/issues/120#issuecomment-3919556648`
  - acceptance comment: `https://github.com/moldovancsaba/mvp-factory-control/issues/120#issuecomment-3919575598`
  - board status moved to `Done`, issue closed
- `#139` completion evidence captured:
  - acceptance comment: `https://github.com/moldovancsaba/mvp-factory-control/issues/139#issuecomment-3899470139`
  - board status moved to `Done`
- `#140` completion evidence captured:
  - acceptance comment: `https://github.com/moldovancsaba/mvp-factory-control/issues/140#issuecomment-3899436749`
  - board status moved to `Done`
- `#146` completion evidence captured:
  - acceptance comment: `https://github.com/moldovancsaba/mvp-factory-control/issues/146#issuecomment-3899407504`
  - board status moved to `Done`
- `#145` completion evidence captured:
  - acceptance comment: `https://github.com/moldovancsaba/mvp-factory-control/issues/145#issuecomment-3899368674`
  - board status moved to `Done`
  - revalidation evidence refresh: `https://github.com/moldovancsaba/mvp-factory-control/issues/145#issuecomment-3919822309`
- `#203` completion evidence captured:
  - start comment: `https://github.com/moldovancsaba/mvp-factory-control/issues/203#issuecomment-3919974581`
  - acceptance comment: `https://github.com/moldovancsaba/mvp-factory-control/issues/203#issuecomment-3919976813`
  - board status moved to `Done`, issue closed
- `#132` acceptance summary:
  - command policy classes/risk tiers and deny-by-default matching delivered
  - approval-token expiry/fingerprint/replay enforcement delivered
  - allow/deny/approval outcomes captured in lifecycle audit evidence
  - build gate pass: `cd apps/warroom && npm run build`
- context-pressure checkpoint: continuation context is treated as near 70%; execution remains constrained to ordered scope with handover-first updates before each implementation start.
- incident capture completed (`#144`, Done): Docker runtime regressions are now codified in board evidence and doctrine docs.

## 2) Architecture truth snapshot

SSOT split:
- portfolio state: GitHub Project 1
- runtime/transcripts/queue: Postgres via Prisma

Control rules:
- only lease-holding orchestrator path may write protected lifecycle transitions.
- only ALPHA role may run control-plane worker authority.
- BETA control intents are denied with explicit reason and audit trail.

Execution rules:
- worker claim gate requires `enabled=true`, runnable runtime, readiness `READY`.
- retries/backoff/dead-letter behavior is deterministic and audited.
- invalid or unsafe routing degrades to `MANUAL_REQUIRED` with explicit reason.

## 3) Known gaps (intentional backlog)

Backlog gaps still open:
- post-MVP hardening lane (none; fully delivered)
- OpenClaw-inspired WarRoom hardening intake (`#204`-`#206`) pending promotion/execution.
- Docker portability dependency chain:
  - preflight contract (`#111`) done
  - app containerization (`#112`) done
  - full compose health stack (`#113`) done
  - bootstrap/migrate/verify path (`#114`) done
  - automated portability gate (`#115`) done
  - umbrella tracking (`#116`) done

Deferred/future initiatives:
- milestone extension (`#92`)
- connectors/teaming/discovery/multi-orchestrator (`#83`, `#84`, `#85`, `#86`)

## 4) Operational commands

Live WarRoom board statuses:
```bash
cd /Users/moldovancsaba/Projects/mvp-factory-control
gh issue list --state all --limit 400 --json number,title,projectItems \
  | jq -r '.[] | {n:.number,t:.title,s:(.projectItems[]?.status.name // "(none)")} | select(.t|contains("WarRoom")) | "#\(.n)\t\(.s)\t\(.t)"'
```

Prompt package validation gate:
```bash
cd /Users/moldovancsaba/Projects/mvp-factory-control
node scripts/mvp-factory-validate-prompt-package.js --issue <ISSUE_NUMBER> --repo moldovancsaba/mvp-factory-control
```

Build gate:
```bash
cd /Users/moldovancsaba/Projects/mvp-factory-control/apps/warroom
npm run build
```

## 5) Document ownership (anti-duplication)

- `docs/WARROOM_WHY_AND_HOW.md`: corporate WHY/HOW and initiative framing.
- `docs/WARROOM_MANIFESTO.md`: core philosophy and role model rules.
- `docs/WARROOM_DELIVERY_STORY.md`: milestone narrative and acceptance posture.
- `docs/WARROOM_MVP_SPINE_AND_BACKLOG.md`: invariants, lane contract, initiative map.
- `docs/WARROOM_DOCKER_PORTABILITY_HEALTH_REPORT.md`: Docker portability rubric and current healthy-level assessment.
- `docs/WARROOM_E2E_TESTS.md`: e2e harness command pack and latest run evidence.
- `docs/WARROOM_RECOVERY_READINESS_RUNBOOK.md`: recovery drill workflow, incident bundle schema contract, and readiness rubric.
- `docs/WARROOM_HANDOVER.md`: operational continuation pack.
- this file: concise status digest and command pack only.

## 6) Operational incident learning (latest)

Incident reference:
- `#144` `[Bug] WarRoom: Capture and codify Docker runtime incident learnings (permissions + ps portability)`

What failed:
- container runtime could not write `/app/.warroom` (permission denied).
- `/agents` route used non-portable `ps` flag (`command`) not supported in Alpine runtime.

Fix commits:
- `3260deb`: dedicated port defaults + bootstrap hardening + runtime writable `.warroom`.
- `dd44b3e`: portable worker process listing (`ps -eo pid=,args=`).

Evidence checklist now required on runtime-affecting work:
1. `./scripts/warroom-docker-bootstrap.sh` passes.
2. `docker compose ps` shows healthy app+db.
3. `docker logs --tail 200 warroom-app` shows no permission or `ps` portability errors.
4. route probes: `/signin`, `/products`, `/agents`.
