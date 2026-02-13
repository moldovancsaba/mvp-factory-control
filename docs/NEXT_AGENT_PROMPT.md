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
- Incident-learning loop is mandatory:
  - if runtime/container failure is found, open/update a board issue in the same session,
  - attach RCA + fix evidence + verification commands,
  - update handover/status docs before closing the issue.

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
10) For runtime/Docker changes, include portability verification evidence:
   - `docker compose ps`
   - `docker logs --tail 200 warroom-app`
   - route checks: `/signin`, `/products`, `/agents`

Next action:
- Promote #136 to Ready (after prompt-package validation), then execute.
- Keep locked-order execution for remaining launch chain.
- If context pressure rises again, stop scope expansion and refresh handover/status before continuing.
