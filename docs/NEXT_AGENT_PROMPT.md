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
7) /Users/moldovancsaba/Projects/mvp-factory-control/docs/WARROOM_E2E_TESTS.md

Current board truth (WarRoom):
- Launch lane #130 -> #138 is fully Done.
- Post-MVP hardening lane is fully Done:
  - #145 (Done) portability gate parity + route/runtime regression checks
  - #146 (Done) filesystem safety regression harness
  - #140 (Done) secrets/DLP guardrail
  - #139 (Done) cancel/interrupt/resume semantics
- WarRoom counts: Done 53, Ready 0, IDEA BANK 11, Roadmap 5

Execution loop per issue:
1) Confirm selected issue is Ready on board.
2) Validate prompt package:
   node /Users/moldovancsaba/Projects/mvp-factory-control/scripts/mvp-factory-validate-prompt-package.js --issue <ISSUE_NUMBER> --repo moldovancsaba/mvp-factory-control
3) Handover-first updates:
   - /Users/moldovancsaba/Projects/mvp-factory-control/docs/WARROOM_HANDOVER.md
   - /Users/moldovancsaba/Projects/mvp-factory-control/docs/WARROOM_STATUS_BRAINDUMP.md
4) Move issue to In Progress and post start comment.
5) Implement scope with invariants intact.
6) Validate:
   cd /Users/moldovancsaba/Projects/mvp-factory-control/apps/warroom && npm run e2e:warroom
   cd /Users/moldovancsaba/Projects/mvp-factory-control/apps/warroom && npm run build
7) Post concise acceptance evidence comment.
8) Move issue to Done.
9) Refresh handover/status/spine docs and board snapshot before next issue.

Constraints:
- Board is SSOT. Keep board fields + issue evidence updated after each meaningful step.
- Preserve lease/role/lifecycle/email-ingress safety invariants.
- No secrets in output/logs/UI/comments.
- Additive/reversible changes only; do not revert unrelated local changes.

Next action now:
- De-dupe cleanup is complete (`#148`/`#149`/`#150`/`#151`/`#152` closed with rationale comments; status moved to `Done`).
- `#119` is complete (`Done`) and closed with acceptance evidence.
- `#141` is complete (`Done`) and closed with acceptance evidence.
- `#142` is complete (`Done`) and closed with acceptance evidence.
- `#120` is complete (`Done`) and closed with acceptance evidence.
- Next executable focus: promote `#143` to `Ready` with prompt-package validation, then execute.
