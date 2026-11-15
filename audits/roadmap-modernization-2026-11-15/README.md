# Roadmap modernization assessment — 15 November 2026

Tracking: [#942](https://github.com/moldovancsaba/mvp-factory-control/issues/942). Canonical portfolio board: [Project 1](https://github.com/users/moldovancsaba/projects/1).

The first cleanup is recording tracking discrepancies in issues, followed by requirement-level rebaselining. New technology is an implementation option, not evidence that a business requirement is obsolete. Existing code is evidence of implementation surfaces, not of successful production acceptance.

**Owner's final instruction: project boards are read-only. Never modify a board; update issues only.** The board is the owner's source of truth and must retain historical context. Recommendations about state mismatches below are observations for issue records, not permission to edit cards or project metadata. Earlier rejected API write attempts made no board changes; no further board writes are permitted even if access becomes available.

## Coverage and evidence limits

The baseline was captured before creating #942. It contains all **183 Project 1 items**, all **471 repository issues** (82 open, 389 closed), and **874 repository issue comments**. Pull requests were excluded from issue totals. The register covers every board item plus all 33 open issues not on this particular board: **216 distinct entries**. One entry is a board-only draft and one is a pull request retained as board history. This is not an audit of every product's runtime or every board in the portfolio.

| Observation | Count | Meaning |
| --- | ---: | --- |
| Board items marked Done | 73 | Historical board state; no new delivery claim |
| Board items outside Done | 110 | Includes 9 items with no Status |
| Closed issues outside Done | 60 | State mismatch needing reconciliation |
| Of those, migration-comment evidence | 55 | Follow destination issue; not a delivered-feature count |
| Of those, completed closure reason | 5 | #448, #449, #450, #918, #920; read recorded limits |
| Open issues on Project 1 | 49 | Active issue tracking visible here |
| Open issues absent from Project 1 | 33 | Check their product boards; absence here is not absence everywhere |
| Board-only draft | 1 | Multi-model architecture; no repository issue number |

The actual Project 1 schema has 13 fields and **no Product field**. Consequently #747's premise that only the Trinity option is absent is stale: repair/confirm the taxonomy contract first. Status has `IDEABANK (SOMEDAY)` and `Declined (NEVER)`; old documentation's `IDEA BANK` shorthand is not the exact live value.

Project 1 item/field reads succeeded. A direct attempt to add #942 to Project 1 returned `Resource not accessible by integration (addProjectV2ItemById)`. Listing all account/organization projects also returned resource-access errors. Board writes and portfolio-wide board discovery are therefore access-blocked on this API connection, not evidence of missing boards. No existing card has been moved by this assessment.

## Decision clusters

| Cluster | Concrete items | Finding | Recommended treatment |
| --- | --- | --- | --- |
| Migrated tracking | #41 → messmass#121; #50 → #127; #55 → #132; #73 → #141; full mappings in register | 55 closed cards still outside Done, with explicit migration comments | Reconcile old card with its destination and destination board. Retire the old tracking copy; never label the feature shipped just because it migrated. |
| Finished tracking with stale board state | #448–450, #918, #920 | Closed as completed but still in Backlog/Review/In Progress | Reconcile board after reading existing acceptance limitations. #450 explicitly did not prove a completely isolated clean-user installation. |
| Exact duplicates | #230/#233 and #30/#31 | Both pairs have identical titles **and bodies** in the baseline | Keep #230 and #30 as canonical; reconcile comments and mark #233/#31 duplicate. Do not merge the two different product areas. |
| Superseded architectural target | #447 Hybrid orchestrator acceptance | Current Sovereign README says legacy Hybrid fragments were removed; source contains a governed Python DAG | Rebaseline acceptance onto the current DAG and its actual API/approval/recovery path. Do not revive the historical Hybrid endpoint to satisfy a stale ticket. |
| Existing implementation needing gap acceptance | Hatori #259–279, #363–366, #427; Amanoba Courses #504–513 | Source now contains many capabilities the old issue text still introduces as new | Map each original criterion to current code and repeatable acceptance. Implement only the remaining gap; do not close from a symbol or README alone. |
| Simplifiable implementation choices | #443 wiki, #445 Theia, #446 provider layer; draft model architecture | Goals still useful; implementation assumptions need current evidence | Reuse docs/MCP, current operator UI and existing provider gateway before adding another wiki, UI shell or inference abstraction. Local-first constraints remain. |
| Still-valid business capabilities | Amanoba mobile, live sessions, instructors, community, certificates, video, personalization, quiz migration | Frameworks do not supply enrollment, permissions, learning policy, moderation or approval | Consolidate parent/child scope and choose technology after inspecting product source and its board; retain requirements. |
| Conflicting feedback policy | #269 versus #276; related #230/#232 | #269 proposes low-confidence positive silence; #276 explicitly forbids no-feedback=positive in UI | Resolve the product policy. Treat silence as unlabelled; never infer approval, factual memory or training permission. This is a recommendation, not a claim the policy has already changed. |

The July migration was later reversed for non-Messmass work. For example, #513 was migrated to messmass#189 and then explicitly reopened here; the copy was closed. The current issue state and latest reversal take precedence over an old migration comment. The same pattern occurs in Hatori and duplicate candidates. The register does not redirect an open issue solely because such a comment exists.

## Current-source findings

### Sovereign: consolidate on the current runtime

Inspected revision: [`6cdcffe`](https://github.com/moldovancsaba/sovereign/tree/6cdcffe6553ee2e5d229df8f9a6484fe8d897f54).

- [README](https://github.com/moldovancsaba/sovereign/blob/6cdcffe6553ee2e5d229df8f9a6484fe8d897f54/README.md) describes the governed Python DAG and removal of Hybrid fragments. [orchestrator.py](https://github.com/moldovancsaba/sovereign/blob/6cdcffe6553ee2e5d229df8f9a6484fe8d897f54/apps/sovereign/scripts/sovereign_dag/orchestrator.py) contains the five-node routing loop. This invalidates #447's historical acceptance target, not the need for operator acceptance.
- [providers.py](https://github.com/moldovancsaba/sovereign/blob/6cdcffe6553ee2e5d229df8f9a6484fe8d897f54/apps/sovereign/scripts/sovereign_dag/providers.py) already has `ComputeMatrix`, MLX/Ollama health selection, an OpenAI-compatible client and embedding helper. #446 should verify coverage, failure behavior and explicit local/cloud boundaries. An OpenClaw tool adapter is a separate concern from inference transport.
- Theia documentation still exists. Theia itself has not been established as deprecated. #445 needs a product decision about maintaining an IDE shell alongside the control room, not a blanket removal instruction.
- [dispatcher.py](https://github.com/moldovancsaba/sovereign/blob/6cdcffe6553ee2e5d229df8f9a6484fe8d897f54/apps/sovereign/scripts/sovereign_dag/nodes/dispatcher.py) has a human-approval branch; that alone does not prove #444's protected-path/self-modification policy is satisfied.

### Hatori: acceptance and retrieval quality before replacement

Inspected revision: [`b7b1899`](https://github.com/moldovancsaba/hatori/tree/b7b18991f468c9c6953fd5069c81dc310fb62f67).

- [api/app.py](https://github.com/moldovancsaba/hatori/blob/b7b18991f468c9c6953fd5069c81dc310fb62f67/api/app.py) exposes respond, feedback, outcome, ingestion, upload and search endpoints. [ui/app.py](https://github.com/moldovancsaba/hatori/blob/b7b18991f468c9c6953fd5069c81dc310fb62f67/ui/app.py) now defines `is_greeting_only`, contradicting #363's original missing-symbol premise. The original failing API regression still needs rerunning.
- [pks.py](https://github.com/moldovancsaba/hatori/blob/b7b18991f468c9c6953fd5069c81dc310fb62f67/hatori/pks.py) contains pending-write, approve, deprecate and audit helpers. This does not prove all contested/conflict and Memory Patch cases; #266/#267 remain requirement checks.
- [model.py](https://github.com/moldovancsaba/hatori/blob/b7b18991f468c9c6953fd5069c81dc310fb62f67/hatori/model.py) already defines `ModelAdapter`, LlamaCpp/Ollama/MLX adapters and task routing. #262 should test behavior across swaps rather than rebuild the interface.
- [rag.py](https://github.com/moldovancsaba/hatori/blob/b7b18991f468c9c6953fd5069c81dc310fb62f67/hatori/rag.py) delegates indexing and search to existing CLI functions and resolves artifact citations. A hybrid-retrieval recommendation is a benchmark proposal, not a claim the current system lacks hybrid ranking.

### Amanoba Courses: existing lifecycle, residual safety requirements

Inspected revision: [`dd58e75`](https://github.com/moldovancsaba/amanoba_courses/tree/dd58e7589c1f8ca99b727515aefe52b6d01dc5c9).

[current-ssot.md](https://github.com/moldovancsaba/amanoba_courses/blob/dd58e7589c1f8ca99b727515aefe52b6d01dc5c9/docs/current-ssot.md) and [daemon.py](https://github.com/moldovancsaba/amanoba_courses/blob/dd58e7589c1f8ca99b727515aefe52b6d01dc5c9/course_quality_daemon/daemon.py) show staged creation, source CRUD/review, QC handoff, explicit draft import, publish and rollback. [dashboard.py](https://github.com/moldovancsaba/amanoba_courses/blob/dd58e7589c1f8ca99b727515aefe52b6d01dc5c9/course_quality_daemon/dashboard.py) exposes lifecycle controls and matching routes.

For #504–511/#513, retain original criteria but change the execution goal to proving existing paths and filling gaps. For #512, existing provenance and rollback helpers are not evidence of a complete immutable audit contract. Test attribution, history integrity, permission revocation, rejected source reuse, repeat/ambiguous publish, restart/recovery and rollback semantics before closing any safety work. No course was generated, imported or published during this assessment.

## Technology replacement options and acceptance gates

These are recommendations, not installed dependencies or migration approvals. Current primary documentation was checked on 15 November 2026; no claim that each technology is newly invented or universally superior is intended.

| Opportunity | Preferred bounded option | What it replaces | Decision gate |
| --- | --- | --- | --- |
| Local knowledge retrieval | Existing PostgreSQL full-text search + pgvector; evaluate reciprocal rank fusion and optional reranking | A new standalone search store or a new basic ingestion stack, where existing local storage suffices | Frozen relevant/nonrelevant corpus, Recall@k and citation accuracy, latency/memory baseline, local/offline operation and access filtering. [PostgreSQL](https://www.postgresql.org/docs/current/textsearch.html), [pgvector](https://github.com/pgvector/pgvector) |
| Atlas-based product search | Atlas Search + Vector Search fusion, only for a product already using Atlas | Parallel search infrastructure where the existing deployment meets requirements | Check deployed MongoDB capabilities, indexes, cost, tenant filtering and relevance. Do not move local Hatori data to cloud. [MongoDB hybrid search](https://www.mongodb.com/docs/vector-search/hybrid-search/hybrid-search-overview/) |
| Long-running creation/approval | First harden existing local checkpoints; optionally evaluate self-hosted LangGraph persistence | Bespoke retry/resume plumbing only where the current implementation has measured gaps | Kill/restart at every checkpoint, resume without duplicate publication, approval revocation, versioned artifacts and preserved local operation. A checkpointer does not implement course policy. [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence) |
| Hosted asynchronous work | Vercel Workflow for an already approved hosted app; Queues for delivery/fan-out | Request-bound long tasks and hand-built cloud polling | Explicit data/hosting decision, idempotency, bounded retry, dead-letter/recovery, human approval and measured cost. Not a default replacement for local workers. [Workflow](https://vercel.com/docs/workflows), [Queues](https://vercel.com/docs/queues) |
| Read-only knowledge access (#443) | Versioned repository Markdown served as MCP resources | Mandatory operation of a second wiki for material already maintained in Git | Stable resource URIs, authorization, source revision/citations, unavailable-resource behavior. Keep a self-hosted wiki when collaborative editing actually needs it. [MCP resources](https://modelcontextprotocol.io/specification/2025-11-25/server/resources) |
| Operator interface (#445 and old style cards) | Reuse governed GDS contracts in the current product interface | Duplicate UI primitives/shells where no unique IDE requirement exists | Route/task parity, permissions, loading/error states, keyboard/screen-reader acceptance. [GDS entry contract](https://github.com/sovereignsquad/general-design-system/blob/main/llms.txt) |
| Mobile learning (#7/#12/#20/#21) | PWA/service worker/IndexedDB proof first; native/Expo if device requirements justify it | Unconditional second native codebase | Actual target-device offline/reconnect tests, protected cache cleanup, progress-conflict handling and necessary background capabilities. [MDN offline guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation) |
| Feedback and personalization | Attributable examples + frozen evaluation and explainable rules; structured model output only for validated subtasks | Treating feedback/silence as automatic model training or unrestricted recommendations | Explicit consent, separation of observations/preferences/facts, cross-model regressions and measurable learning benefit. No training or promotion is authorized by this audit. |

## Execution order

1. Record migrated/completed tracking discrepancies in issues and identify canonical duplicate issues; preserve destination-board ownership and leave all boards unchanged. Do not interpret `not_planned` migration closures as delivered features.
2. Rebaseline #447/#446 and Hatori source-present capabilities, keeping current contracts and approval boundaries.
3. Rebaseline #504–513 against the actual creator lifecycle; leave unresolved safety and acceptance cases open.
4. Resolve #269/#276 feedback-policy conflict and #747's missing Product-field premise.
5. Commission one bounded retrieval/checkpoint/UI proof only where an acceptance gap justifies it; compare against current behavior before selecting a replacement.
6. Route still-valid learning, mobile, media, community and instructor work through the associated product boards. Parent/child tickets remain separate when deliverables differ.

## Deliverables and verification

- [register.csv](register.csv): readable per-item cluster, disposition, evidence and next action.
- [register.json](register.json): identical 216-entry machine-readable baseline, including board IDs/states and confidence.
- Live issue updates are tracked under #942. The dated baseline intentionally preserves pre-update states; it is not a continuously synchronized board export.
- All 82 pre-existing open issues received a dated assessment with an updated execution goal, confidence and evidence. #233 and #31 were then closed as duplicate tracking copies of #230 and #30, respectively; original text and comment history were preserved. These are duplicate closures, not product-delivery claims. The new #942 tracking issue is outside the 82-issue baseline. [Issue update receipts](issue-update-receipts.json) retain update timestamps and body hashes; canonical-issue reconciliation notes were added after those initial body-update hashes.
- Structural portfolio validator, its failure fixtures and official font verification passed locally. Register invariants and diff hygiene are checked separately. No product runtime acceptance or end-to-end feature completion is claimed.
- Rollback: revert assessment/process documentation and remove the dated assessment sections from issues using their recorded baseline. No product data, service, deployment or model configuration changes are part of this work.
