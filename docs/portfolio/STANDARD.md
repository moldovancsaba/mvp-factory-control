# Repository orientation quality standard

## Purpose and authority
A repository is accepted when someone can identify its purpose and real status, reach its authoritative documentation and find where work belongs without guessing. Speed, issue counts, document volume and repositories touched are not KPIs.

This directory maintains public discovery records. Product repositories own implemented behaviour and operational instructions. GDS owns shared design/UI/UX. Existing product delivery boards remain authoritative until routing has been reconciled; this standard does not migrate their issues.

## Evidence contract
Keep source URL, observation date, inspected revision/settings snapshot, fact versus claim, owner, verification method and outcome with each repair. Refresh before editing. Unknown is valid during investigation; it blocks any dependent factual claim. A README title is an observed identity, not verified product ownership. A populated homepage is not verified availability.

Public repositories must never contain restricted inventory, credentials or private operational details. Before changing visibility, ownership or repository names, assess downstream references and obtain any required authorisation.

## Required welcome information by role
| Role | Required content |
| --- | --- |
| All | Purpose/audience, name/aliases, evidenced lifecycle, authoritative links, ownership/support and delivery routing |
| Hosted application | Implemented versus planned scope, safe setup/configuration, verification, production and recovery links |
| Local tool/agent | Supported environment, install/start/stop, background operation, data boundaries and recovery |
| Library/design system | Consumers, access/install, supported versions, usage and release guidance |
| Monorepo/prototype | Product-to-path map, separate statuses and product-specific run instructions |
| Redirect/assets | Destination or served assets, owner, update/verification procedure |
| Empty/retired | Honest current state and intent/replacement; no invented run commands |

Descriptions state actual purpose and audience. Topics reflect verified useful classifications; no minimum count. Website fields have a documented destination role. READMEs link detailed runbooks and delivery work instead of duplicating them. Preserve useful detail and historical attribution when reorganising.

## Delivery gates
Ready: current evidence, resolved identity for the change, exact targets, owner, dependency/routing, binary checks and rollback.
Implementing: one scoped repair, no guessed capability, no unrelated runtime changes.
Verifying: separate review pass of final GitHub result and applicable checks.
Done: all mandatory gates below pass. Missing access and unresolved material contradictions remain Blocked. Inapplicability needs a reason and evidence.

| Gate | Required outcome |
| --- | --- |
| Accuracy | Material claims match inspected source; fixtures/pilots/roadmap distinguished |
| Navigation | Find by purpose or alias; identify lifecycle; open correct product/docs; locate support/work; trace dependencies |
| Operations | Applicable safe instructions exercised in stated environment with recorded outcomes |
| Integrity | File paths/anchors and relevant external destination identity verified; HTTP success alone insufficient |
| Consistency | About, README, product/control/GDS authority and version distinctions agree |
| Privacy/accessibility | Restricted information excluded; licences retained; meaningful headings/links/alt text; GDS for UI |
| Delivery | Reviewed commit/PR, checks, settings before/after evidence, applicable release/deployment and recovery |

The implementer and acceptance reviewer perform distinct passes; the sole maintainer may perform both at separate stages. No stopwatch or fixed batch target applies. Default to one active repair and one awaiting review. Reopen accepted work when evidence invalidates it.

## Issue and release contract
Use [GDS engineering issue #81](https://github.com/sovereignsquad/general-design-system/issues/81), plus the control repository's executable prompt package. Explain sections that do not apply. Record exact settings/files, dependencies, owner/reviewer, validation, rollback, known limits and commit/PR references. Release notes contain New Features, Fixed Bugs, Known Issues and Future Roadmap.

Hosted runtime/backend changes retain applicable production-deployment requirements. Documentation-only work records deployment impact and follows the repository's effective release policy. Local-only tooling and redirects use their appropriate verified delivery path; never invent a hosted backend.

## Maintenance
Review affected surfaces when identity, URL, setup, owner, architecture or release changes. Review active/shared records monthly and portfolio coverage quarterly as freshness checks, not delivery deadlines. Exceptions record evidence, rationale, owner and resolution/review trigger; unresolved defects do not become accepted through an exception.

## Run structural checks

From the repository root, run `node scripts/validate-portfolio.mjs` and `node scripts/validate-portfolio.mjs --self-test`. These checks do not perform the semantic, destination or operational review required for acceptance.
