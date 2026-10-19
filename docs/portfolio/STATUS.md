# Portfolio delivery status

Updated: 19 October 2026. Delivery state and current checks are tracked in the linked GitHub issues and pull requests.

## Delivered
- [Foundation PR #919](https://github.com/moldovancsaba/mvp-factory-control/pull/919), merged at ff409111557ff309370f4d305a309a80de8c43b3: public evidence register, navigation, role-specific quality standard and native validator.
- Control repository About description and project-management topic: saved and verified through repository metadata readback.
- GDS description and design-system topic: saved and verified in [GDS issue #943](https://github.com/sovereignsquad/general-design-system/issues/943).
- DoneIsBetter welcome and release notes: [commit 1467e603](https://github.com/moldovancsaba/doneisbetter/commit/1467e6036aa3b1a52feb115d6b4461638c54b824), accepted for documentation scope in [#921](https://github.com/moldovancsaba/mvp-factory-control/issues/921). Source limitations, including the missing per-card DELETE route, are explicit.

- Eight public About descriptions: saved and independently verified in [#922](https://github.com/moldovancsaba/mvp-factory-control/issues/922); issue closed and project status Done. Existing websites, visibility and topics were preserved.

- Replace welcome, implementation note and About description: [replace PR #1](https://github.com/moldovancsaba/replace/pull/1), verified on main at b8b4c413d06d56536afd22f5b49a482d270ae63c. [Issue #925](https://github.com/moldovancsaba/mvp-factory-control/issues/925) records synthetic API/queue verification and the explicitly unconfigured image processor.

- Class Scout NY welcome: [PR #3](https://github.com/moldovancsaba/nyc-kid-scout/pull/3), merged and read back at 44a033fbd5488e25c9652ef846c6d3c93b2b11c9. The README distinguishes generated data, browser-local state, simulated checkout and the separately hosted assistant. Default-branch installation remains blocked; [draft lockfile PR #1](https://github.com/moldovancsaba/nyc-kid-scout/pull/1) and [product issue #2](https://github.com/moldovancsaba/nyc-kid-scout/issues/2) retain failed lint/dependency baseline evidence. The Class Scout About description is now saved and independently verified after desktop recovery; website, topics and visibility are preserved. [Control issue #927](https://github.com/moldovancsaba/mvp-factory-control/issues/927) records scoped welcome acceptance and final board reconciliation.

- Seyu Solutions welcome and build hygiene: [commit 81f3667](https://github.com/moldovancsaba/seyusolutions/commit/81f366764e36799a6880cac29acc6cb2112f9eb9) adds the missing README and dated product audit entry, refreshes dependencies within the existing manifest and fixes native ESM config directory references. Candidate run [39249014364](https://github.com/moldovancsaba/mvp-factory-control/actions/runs/39249014364) passed six-page build/preview with zero build warnings/errors and zero advisories. Product publication [39259645510](https://github.com/moldovancsaba/seyusolutions/actions/runs/39259645510) and downstream Pages deployment [39259686152](https://github.com/moldovancsaba/seyusolutions/actions/runs/39259686152) passed. About/website are saved and independently verified; [#930](https://github.com/moldovancsaba/mvp-factory-control/issues/930) retains limitations and final acceptance evidence. Older deployment actions emit deprecation warnings outside the clean Vite build; lifecycle and full product routing remain investigations.

## Verification path
The required portability-gate workflow runs public register/index consistency checks and self-tests and real Docker build, migrations, app startup and health probes in a disposable runner. It uses synthetic configuration, preserves branch protection and does not access production data.

PR #919 passed its final pre-merge run 39180701825. Post-merge run 39180893481 then exposed an intermittent Google font-loader failure. [Repair PR #923](https://github.com/moldovancsaba/mvp-factory-control/pull/923) bundles the existing IBM Plex families through next/font/local with official source hashes and SIL Open Font License. [Issue #920](https://github.com/moldovancsaba/mvp-factory-control/issues/920) is closed with acceptance evidence: PR run [39181501476](https://github.com/moldovancsaba/mvp-factory-control/actions/runs/39181501476) and post-merge main run [39181754231](https://github.com/moldovancsaba/mvp-factory-control/actions/runs/39181754231) both passed.

## Open work and access
The computer-control connection recovered and the eight reviewed About-description corrections in [#922](https://github.com/moldovancsaba/mvp-factory-control/issues/922) are delivered. Settings writes were performed in the authenticated GitHub browser and independently read back through the repository API. The connected source/issue/PR interface still does not expose About-setting writes; browser access is the verified path for future metadata repairs.

The control repository is public. Restricted inventory stays outside it. Product-specific routing, operational lifecycle, external destination identity and setup reproducibility remain investigations unless recorded otherwise. GitHub's live status picker has Review (ALMOST) and no Blocked option; access blockers are explicit in issue evidence.

## Remaining programme
D01 identity/evidence and D11 per-product routing remain investigations. D02 standard and initial D10 structural validation are implemented. D03 destinations, D04 remaining contradictions, D05 complete pilots, D09 effective defaults, D06 remaining welcomes, D07 connected systems, D08 remaining coverage and D12 final acceptance remain open.

Select each repair by operational risk and evidence readiness. Quality and reviewed task outcomes govern acceptance; speed, volume and fixed batch quotas are not performance measures. A record's existence does not imply product acceptance.

## Recovery
Revert the relevant scoped commit for documentation or configuration rollback. Keep failed verification visible and branch protection enabled. Returning to build-time Google font downloads reintroduces the observed external dependency.
