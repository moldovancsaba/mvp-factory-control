# MVP Factory War Room - Status + Brain Dump

Last updated: 2026-02-13
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

Current WarRoom board posture (as-of 2026-02-13):
- IDEA BANK: 17 (`#118`-`#129`, `#139`-`#143`)
- Roadmap: 6
- Backlog: 5 (`#133`, `#134`, `#135`, `#137`, `#138`)
- Ready: 0
- In Progress: 0
- Done: 34

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
  - roadmap umbrella `#130`
  - `#131` delivered (`Done`) with acceptance evidence + build pass
  - `#132` delivered (`Done`) with policy/approval gate evidence + build pass
  - `#136` delivered (`Done`) with workspace-bounded filesystem tools, traversal/symlink protections, binary policy checks, and policy-gated mutation execution
  - remaining backlog chain `#133`, `#134`, `#135`, `#137`, `#138` (shell runtime, streaming/artifacts, runtime issue evidence, git ops, launch rehearsal)
  - locked order from next execution: `#133 -> (#134 + #137) -> #135 -> #138`
- prompt package validator pass confirmed for launch cards `#130`-`#138`.
- runtime umbrella `#75` is now closed (`Done`) with evidence linked to delivered child issues `#93` + `#94`.
- additional foundation ideas captured in `IDEA BANK`: `#139`-`#143` (task controls, DLP, provenance, runtime SLOs, ephemeral workspace).
- new idea intake lane is active: all speculative and emerging WarRoom ideas now enter `IDEA BANK` first before roadmap/backlog triage.
- active executable item: none (`#133` is next candidate after Ready promotion).
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
- dev-operator cockpit runtime chain (`#130` umbrella, `#131`-`#138` execution plan)
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
