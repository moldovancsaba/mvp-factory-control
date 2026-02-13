# WarRoom - MVP Spine and Backlog Contract

Last updated: 2026-02-13
Owner: Sultan (Product Owner) + War Room agent team
Scope: `apps/warroom`

Related doctrine:
- `docs/WARROOM_WHY_AND_HOW.md`
- `docs/WARROOM_MANIFESTO.md`
- `docs/WARROOM_DELIVERY_STORY.md`

## 1) Purpose of this document

This file defines:
- non-negotiable MVP invariants,
- lane rules for ideabank/roadmap/backlog/ready flow,
- strategic initiative grouping for near-term and future development.

This file does not store checklist execution state.

## 2) Hard invariants (non-negotiable)

1. Governance invariant
- one orchestrator authority path controls task dispatch and lifecycle writes.
- lease authority is mandatory for control-plane lifecycle operations.

2. Role invariant
- Alpha = decision and coordination authority.
- Beta = scoped execution authority only.

3. Lifecycle invariant
- task transitions are policy-validated and auditable.
- unsafe conditions degrade to explicit manual handling, not silent continuation.

4. Context invariant
- one active Alpha context window per product (MVP lock).
- context guardrail and handover package gates are mandatory.

5. Ingress invariant
- MVP external ingress is email only.

6. Tracking invariant
- GitHub Issues + Project fields are the canonical state for ideabank/roadmap/backlog/execution.

## 3) Lane contract

Status semantics:
- `IDEA BANK`: unfiltered ideas/hypotheses (including speculative ideas); not approved for execution.
- `Roadmap`: directional/future intent, not implementation-ready.
- `Backlog`: approved work not yet executable.
- `Ready`: executable now with a valid prompt package.
- `In Progress`: active implementation.
- `Review`: awaiting acceptance/verification.
- `Done`: accepted and complete.
- `Blocked`: temporarily halted by explicit constraint.

Ready gate rule:
- cards may enter `Ready` only when the Executable Prompt Package is valid.
- invalid `Ready` cards are demoted immediately with issue evidence.

Idea-to-roadmap triage rule:
- all new ideas start in `IDEA BANK`.
- promotion to `Roadmap` requires triage notes (problem, expected value, and why now).
- ideas that become actionable directly may move to `Backlog` instead of `Roadmap`, but never directly to `Ready`.

## 4) Canonical storage rule

- Board is SSOT for all actionable status.
- Docs are doctrine and context only.
- Board fields + issue evidence must be updated after each meaningful execution step.

Live board reference:
- [GitHub Project 1 - MVP Factory Board](https://github.com/users/moldovancsaba/projects/1)

Live audit command (WarRoom subset):
```bash
cd /Users/moldovancsaba/Projects/mvp-factory-control
gh issue list --state all --limit 400 --json number,title,projectItems \
  | jq -r '.[] | {n:.number,t:.title,s:(.projectItems[]?.status.name // "(none)")} | select(.t|contains("WarRoom")) | "#\(.n)\t\(.s)\t\(.t)"'
```

## 5) Snapshot (as-of 2026-02-13)

WarRoom status counts:
- IDEA BANK: 17
- Roadmap: 6
- Backlog: 6
- Ready: 0
- In Progress: 0
- Done: 32

Current Ready cards:
- (none; next candidate is `#136` after Ready promotion gate)

Current IdeaBank cards:
- `#118` WarRoom: Policy simulation and replay harness for governance changes
- `#119` WarRoom: Board-runtime drift sentinel and safe block policy
- `#120` WarRoom: Recovery readiness drills and incident evidence bundle
- `#121` WarRoom: Continuous tech-intelligence ingestion agent (AI source scanning)
- `#122` WarRoom: Fit-analysis agent for discovered technologies (scoring + prioritization)
- `#123` WarRoom: Policy-gated auto-onboarding pipeline for approved new agents
- `#124` WarRoom: Continuous A/B/C/D benchmark and routing optimization for agents
- `#125` WarRoom: Agent capability registry and compatibility matrix
- `#126` WarRoom: Compliance and safety gate for external agent/tool adoption
- `#127` WarRoom: Canary rollout framework for newly onboarded agents
- `#128` WarRoom: Benchmark dataset governance for reproducible A/B/C/D evaluation
- `#129` WarRoom: Cost-aware routing policy (quality/latency/spend tradeoff)
- `#139` WarRoom: Task cancel/interrupt/resume semantics for tool sessions
- `#140` WarRoom: Secrets/DLP guardrail for terminal, file, and chat outputs
- `#141` WarRoom: Execution identity and provenance chain (approver -> runtime -> git author)
- `#142` WarRoom: Tool-runtime SLO dashboard (latency/failures/approval wait/dead-letter)
- `#143` WarRoom: Ephemeral workspace provisioning and cleanup policy

## 6) Strategic initiative map

Initiative A: Control and governance completion (near term)
- `#77` RBAC baseline (`Done`)
- `#80` judgement policy gates (`Done`)
- `#81` taste rubric v1 (`Done`)
- `#91` prompt/package invariants registry (`Done`)
- `#93` runtime config ingestion (`Done`)
- `#94` runtime mutability policy (`Done`)
- `#75` runtime scoped settings umbrella (`Done`)

Initiative B: Delivery maturity and readiness hygiene (current)
- `#103` retrofit prompt packages and restore strict Ready discipline (`Done`)
- ongoing acceptance evidence discipline and gate enforcement
- Docker portability delivery chain:
  - `#111` preflight contract (daemon/tooling gate) (`Done`)
  - `#112` app runtime containerization (`Done`)
  - `#113` full compose stack + health model (`Done`)
  - `#114` one-command bootstrap/migrate/verify (`Done`)
  - `#115` automated portability gate (`Done`)
  - `#116` umbrella program tracking (`Done`)

Initiative C: Scale-out and multi-agent expansion (deferred/future)
- `#92` prototype-to-deliverable milestone extension
- `#83` external connectors
- `#84` dynamic teaming/signaling
- `#85` discovery pipeline
- `#86` multi-orchestrator control

Initiative D: Dev-operator cockpit launch enablement (current)
- `#130` launch umbrella (Roadmap)
- `#131` tool-call protocol (`Done`)
- `#132` command policy + approval gates (`Done`, P0)
- `#136` filesystem tool suite (`Backlog`, P0)
- `#133` sandboxed shell execution engine (`Backlog`, P0)
- `#134` streaming terminal output + artifact capture (`Backlog`)
- `#137` runtime issue-evidence posting (`Backlog`, P0)
- `#135` git operations toolkit (`Backlog`, P1)
- `#138` end-to-end launch rehearsal (`Backlog`)
- execution order lock from next item: `#136 -> #133 -> (#134 + #137) -> #135 -> #138`

## 7) Re-entry and drop rules

- Deferred/future items need owner + explicit re-entry gate before `Ready`.
- Dropped items cannot be moved to `Ready` directly.
- Re-opened dropped scope requires explicit safety case and acceptance criteria.

## 8) Planning decisions to lock next

- ownership and versioning flow for taste rubric updates
- exact schema for judgement gate scoring and audit evidence
- RBAC model boundaries for operator/admin/orchestrator roles
- runtime configuration ownership by product vs global defaults
