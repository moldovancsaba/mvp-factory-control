# READMEDEV

This is the developer and agent operating guide for `mvp-factory-control`.

Read this with:

- [docs/WIKI.md](docs/WIKI.md)
- [docs/PROJECT_MANAGEMENT.md](docs/PROJECT_MANAGEMENT.md)
- [docs/PROJECT_REPOSITORIES.md](docs/PROJECT_REPOSITORIES.md)
- [docs/COMMAND_ACCESS_POLICY.md](docs/COMMAND_ACCESS_POLICY.md)
- [docs/INTERNAL_CONTROL_APP.md](docs/INTERNAL_CONTROL_APP.md)
- [docs/AGENT_PROMPTS.md](docs/AGENT_PROMPTS.md)

## Repository Identity

`mvp-factory-control` is the central control repository for the MVP Factory portfolio.

It manages:

- delivery issues
- board workflow
- prompts and standards
- shared cross-project knowledge

It does not absorb the implementation code of every managed project.

## Managed Projects

- `amanoba`
- `cardmass`
- `hatori`
- `kormanyvalto`
- `launchmass`
- `messmass`
- `narimato`
- `reply`
- `sentinelsquad`
- `sso`

Each project has a page under [`docs/projects/`](docs/projects).

## Working Model

Typical loop:

1. start in `mvp-factory-control`
2. read the issue and board state
3. identify the product repository
4. switch to the product repository if implementation is required
5. make the change there
6. return here to update issue evidence, board state, and shared docs

`apps/mvp-factory-control` is an internal app inside this repository. Treat it as control-plane code owned by `mvp-factory-control`, not as a separate project identity.

## AI Developer Conduct

Agents operate as the active AI developer for the current task and are expected to work with full ownership.

They are allowed to:

- search, modify, create, edit, or delete files required for the task
- use the operator's authenticated GitHub access to inspect repositories, update repositories, commit, and push when the task requires it
- execute autonomously on implementation

They are not allowed to proceed on uncertain assumptions.

If something is not clear enough to implement correctly, they must stop guessing and ask.

## Required Reading Order

1. [docs/WIKI.md](docs/WIKI.md)
2. [docs/PROJECT_MANAGEMENT.md](docs/PROJECT_MANAGEMENT.md)
3. [docs/PROJECT_REPOSITORIES.md](docs/PROJECT_REPOSITORIES.md)
4. [docs/COMMAND_ACCESS_POLICY.md](docs/COMMAND_ACCESS_POLICY.md)
5. the relevant product page under `docs/projects/`
6. [docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md)
7. [docs/UI_UX_STANDARDS.md](docs/UI_UX_STANDARDS.md)

## Non-Negotiables

- do not bypass the board for delivery work
- do not treat this repository as the implementation home for unrelated products
- do not treat `apps/mvp-factory-control` as a replacement name for this repository
- do not hide cross-project rules inside one product repo
- do not hardcode data or bake style systems into product code when a reusable standard is required
- do not leave shared docs stale when global behavior changes
- do not use placeholders, filler text, or unverified content in code or documentation
- do not leave builds with warnings, errors, deprecated APIs, or avoidable dependency sprawl

## Decision Table

If the work changes portfolio process, issue flow, prompts, standards, or operator tooling, it belongs here.

If the work changes a product feature, product code, product setup, or product-local documentation, it belongs in the relevant product repository.

If the work changes the internal orchestration UI or execution support inside [`apps/mvp-factory-control`](apps/mvp-factory-control), it still belongs here because that app is part of this repository.

## Documentation Responsibility

Documentation is part of the deliverable, not follow-up work.

Rule:

- if code changes, documentation review happens immediately
- if behavior changes, documentation changes in the same work window
- if documentation is stale, the task is incomplete

Standard:

- no `TBD`, placeholder copy, or filler
- no unrelated pasted content
- no mismatch between code and docs

If it is not documented, it is not done.

Update `mvp-factory-control` docs when the change affects:

- portfolio process
- agent operation
- shared standards
- shared product navigation
- cross-project knowledge

Update the product repository docs when the change affects:

- product implementation
- feature behavior
- product-specific setup or architecture

## Local Environment And Command Policy

Agents operating through the internal control app use the local environment configured for the active chat session.

That includes the operator's authenticated GitHub access. Agents should use that access for repository operations when required, including:

- inspecting remotes and repository state
- updating repositories
- committing validated work
- pushing to GitHub

Those actions must still follow the documented command policy and must not be done blindly.

Command execution must follow the shared policy in [docs/COMMAND_ACCESS_POLICY.md](docs/COMMAND_ACCESS_POLICY.md), including:

- categorizing commands by their core executable
- tracking whether a command family is approved, denied, or pending
- adding new command families when they are first required

## Dependency Discipline

Dependency changes are restricted.

Agents must:

- prefer the existing stack and existing approved dependencies
- keep the dependency set minimal
- use supported, maintained versions only
- avoid deprecated, abandoned, or redundant packages
- ask before introducing a new dependency if its necessity is not clearly justified

Delivery quality bar:

- build must be warning-free
- build must be error-free
- build must be deprecated-free
- dependency footprint must be minimized

## Prompt Library

The prompt library is maintained in [docs/AGENT_PROMPTS.md](docs/AGENT_PROMPTS.md).

## Source map: `apps/mvp-factory-control`

Maintain **file-level documentation in source** (`/** ... */` at top of each module). This table is the navigation index; behavior details live in those comments and in Prisma schema.

### `src/lib` (domain + integration)

| Module | Responsibility |
|--------|----------------|
| `prisma.ts` | PrismaClient singleton (dev global reuse) |
| `auth.ts` | NextAuth options (Google, dev credentials, Prisma adapter) |
| `session.ts` | `getServerSession` wrapper |
| `rbac.ts` | Email allowlists → role; `requireRbacAccess` + audit |
| `github.ts` | GraphQL client, project/issue/field helpers |
| `tasks.ts` | Enqueue, transitions, retries, tool envelopes on tasks |
| `lifecycle-policy.ts` | Task/agent transition rules + audit helper |
| `judgement-gates.ts` | Pre-enqueue readiness and BETA control-intent gate |
| `chat.ts` | Chat threads and messages |
| `mentions.ts` / `mentionables.ts` | Parse `@Agent` / build autocomplete list |
| `orchestrator-lease.ts` | Single-row lease + health |
| `orchestrator-introspection.ts` | Dashboard/API aggregate snapshot |
| `runtime-config.ts` | Effective model/endpoint resolution + digest |
| `runtime-settings-mutability.ts` | Which settings keys are editable |
| `settings-store.ts` / `settings-mutations.ts` | JSON settings file + validated mutations |
| `agent-readiness.ts` | Readiness checklist for UI |
| `executable-prompt.ts` | Issue body validation (Executable Prompt Package) |
| `prompt-package-invariants.ts` | Hash/snapshot invariants for prompts/context |
| `alpha-context.ts` | Alpha windows, guardrails (60%/70%), transfers, scope gates |
| `alpha-failure-policy.ts` | Failure class metadata + event recording |
| `handover-package.ts` | Handover markdown validation |
| `tool-call-protocol.ts` / `tool-command-policy.ts` / `tool-call-approval.ts` | Tool envelope + policy + HMAC tokens |
| `email-ingress.ts` | Inbound email → chat/task pipeline |
| `memory-platform.ts` | Memory records, apps, profiles, retrieval |
| `worker-process.ts` | List/spawn worker OS processes |
| `cn.ts` | className join helper |

### `src/app` (UI + API)

| Path | Responsibility |
|------|----------------|
| `layout.tsx` / `page.tsx` / `error.tsx` | Root layout, `/` → redirect, global error boundary |
| `signin/page.tsx` | Sign-in; `Shell` nav in other pages |
| `dashboard/page.tsx` | Board + DB + alpha + orchestrator snapshot |
| `issues/[number]/` | Issue detail, alpha controls, chat, prompt validation |
| `agents/` | Agents, workers, readiness, board reconciliation |
| `products/` | Product settings from JSON + GitHub bootstrap |
| `chat/` | Global chat + mention-driven enqueue |
| `memory/` | Memory UI |
| `settings/` | Local folder + taste rubric |
| `api/auth/[...nextauth]/route.ts` | NextAuth handler |
| `api/ingress/email/route.ts` | Email webhook (bearer / header token) |
| `api/orchestrator/state/route.ts` | JSON introspection |
| `api/memory/records/route.ts` | Memory API |

### Worker and Prisma

| Path | Responsibility |
|------|----------------|
| `scripts/worker.js` | Task runner, tool execution loop |
| `scripts/lib/tool-*.js` | CommonJS ports aligned with `src/lib` TS |
| `prisma/schema.prisma` | All control-app tables and enums |

## Build/Run

Build and run instructions for this repository are documented in [docs/BUILD_AND_RUN.md](docs/BUILD_AND_RUN.md).
