# WarRoom Manifesto

Last updated: 2026-02-13
Owner: Sultan (Product Owner) + War Room agent team
Scope: `apps/warroom`

Related doctrine:
- `docs/WARROOM_WHY_AND_HOW.md`
- `docs/WARROOM_DELIVERY_STORY.md`
- `docs/WARROOM_MVP_SPINE_AND_BACKLOG.md`

## 1) Core truth

WarRoom quality is determined by direction quality.
If Alpha asks the wrong question or decomposes badly, perfect Beta execution still produces the wrong result.

## 2) Alpha and Beta model

Alpha:
- decision and coordination authority
- owns intent interpretation and decomposition
- owns human dialogue quality

Beta:
- execution authority only
- works in constrained scope
- reports outputs and evidence

Humans collaborate through Alpha control flow, not swarm-level free interaction.

## 3) Control-plane discipline

- one orchestrator authority path governs lifecycle transitions.
- role boundaries are explicit and enforced.
- every significant transition must be auditable.
- failure handling must degrade safely, never silently.

## 4) Context lifecycle principle

Context is finite and operationally managed.
When context pressure rises:
- stop scope expansion,
- produce validated handover artifacts,
- transfer continuity explicitly.

No continuity may depend on memory assumptions.

## 5) Prompt/package invariants

- every executable issue must carry a complete prompt package.
- every active context window must carry a handover package and continuation prompt references when required by guardrail.
- invalid readiness is corrected immediately on the board.

## 6) Tracking and documentation discipline

- board is canonical for roadmap/backlog/execution status.
- docs are doctrine, strategy, and operational context.
- after each meaningful step: update board fields, post issue evidence, and close status transitions in the same work window.
- if state is stale in board/docs, execution is non-compliant.

## 7) Future initiative posture

WarRoom evolves in three waves:
1. governance completion (RBAC, judgement, taste, config policy)
2. delivery maturity (strict readiness hygiene and reliable handover)
3. scale-out (connectors, dynamic teaming, multi-orchestrator exploration)

Future expansion does not relax safety invariants.
