# WarRoom Corporate Why and How

Last updated: 2026-02-13
Owner: Sultan (Product Owner) + War Room agent team
Scope: `apps/warroom`

## 1) Why this exists

WarRoom exists to solve a specific operating problem:
- product decisions and execution are currently fragmented across people, channels, and tools.
- delivery quality drops when intent, execution, and evidence are not tightly connected.
- AI assistance is unsafe when control authority is ambiguous.

WarRoom is the control system that keeps these three things aligned:
1. human-owned intent,
2. policy-bound agent execution,
3. auditable evidence.

## 2) Why this model (Alpha/Beta)

The Alpha/Beta model is not branding. It is a safety and accountability design.

- Alpha role:
  - owns decomposition, coordination, and human dialogue.
  - is accountable for direction quality.
- Beta role:
  - executes scoped work.
  - does not decide policy or direction.

This separation prevents silent autonomy drift and keeps responsibility explicit.

## 3) How we operate

WarRoom operations follow one deterministic loop:
1. ideas are captured first as GitHub Issues in `IDEA BANK` (including speculative ideas).
2. triaged ideas move to `Roadmap` (directional) or `Backlog` (approved but not executable).
3. work is promoted to `Ready` only with a valid executable prompt package.
4. orchestrator policy and lease controls execution authority.
5. workers execute in constrained scope with lifecycle guards.
6. evidence is written back to issue comments and board transitions.
7. handover artifacts preserve continuity when context approaches limits.

Non-negotiable operating constraints:
- GitHub Project board is SSOT for ideabank/roadmap/backlog/execution state.
- docs are doctrine and operational context, not checklist storage.
- board fields and issue evidence are updated after every meaningful step.

## 4) How we build the next phases

Priority initiatives are grouped into three tracks.

Track A: Governance completion (near term)
- RBAC baseline (`#77`)
- judgement policy gates (`#80`)
- taste rubric v1 (`#81`)
- prompt/package invariants registry (`#91`)
- runtime config ingestion + mutability policy (`#93`, `#94`)

Track B: Delivery maturity (current transition)
- restore strict prompt-package readiness for P0 backlog (`#103`)
- keep build/validation and evidence discipline strict
- harden operator visibility and safe fallback behavior
- close Docker portability gap with dependency-ordered delivery (`#111` -> `#116`)

Track C: Scale-out (deferred/future)
- runtime scoped settings umbrella (`#75`)
- prototype-to-deliverable milestone extension (`#92`)
- external connectors and dynamic teaming (`#83`, `#84`)
- discovery and multi-orchestrator model (`#85`, `#86`)

## 5) What success looks like

WarRoom is successful when:
- Ready cards are always executable without clarification loops.
- no unauthorized control action can execute silently.
- failures always degrade safely (`MANUAL_REQUIRED` or `DEAD_LETTER`) with explicit reasons.
- handover continuity is deterministic and auditable.
- roadmap and execution state are always board-accurate.

## 6) Document ownership map

- `docs/WARROOM_MANIFESTO.md`: foundational principles and role model.
- `docs/WARROOM_DELIVERY_STORY.md`: milestone narrative and acceptance posture.
- `docs/WARROOM_MVP_SPINE_AND_BACKLOG.md`: invariants + initiative map + lane contract.
- `docs/WARROOM_HANDOVER.md`: current operational continuation pack.
- `docs/WARROOM_STATUS_BRAINDUMP.md`: concise execution delta/status digest.
