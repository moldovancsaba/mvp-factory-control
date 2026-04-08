# Development Playbook

This playbook provides the essential information developers need to work with the MVP Factory Control project.

**Canonical module index:** [READMEDEV.md](READMEDEV.md) → *Source map: `apps/mvp-factory-control`* — use it when navigating the internal Next app.

## Project Overview

`mvp-factory-control` is the central portfolio management repository for the MVP Factory. It manages delivery issues, board workflow, prompts, standards, and shared cross-project knowledge.

## Tech Stack

- **Internal App**: Next.js 14+ with TypeScript
- **Database**: PostgreSQL 16 with Prisma ORM
- **Container**: Docker and Docker Compose
- **AI Orchestration**: Paperclip AI
- **Autonomous Assistant**: OpenClaw
- **Local LLM**: Ollama

## Repository Structure

```
mvp-factory-control/
├── apps/
│   └── mvp-factory-control/    # Internal control app (Next.js)
├── docs/                       # Portfolio governance and standards
├── scripts/                    # Board and validation automation
├── docker-compose.yml          # Full stack orchestration
└── README.md                   # Project documentation
```

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose
- GitHub CLI
- Access to local development environment

### Running the Full Stack

```bash
cd /Users/moldovancsaba/Projects/mvp-factory-control
docker-compose up -d
```

This starts:
- `mvp-factory-control-db` (PostgreSQL on port 3579)
- `mvp-factory-control-app` (Next.js app on port 3577)
- `paperclip-db` (Paperclip database on port 35432)
- `paperclip` (AI orchestrator on port 3100)
- `openclaw-gateway` (Autonomous assistant on port 18789)

### Running the Internal App Locally

```bash
cd /Users/moldovancsaba/Projects/mvp-factory-control/apps/mvp-factory-control
npm install
npm run dev
```

### Database

The internal app uses Prisma. To set up the database:

```bash
cd /Users/moldovancsaba/Projects/mvp-factory-control/apps/mvp-factory-control
npx prisma generate
npx prisma db push
```

## Working Model

1. Start in `mvp-factory-control`
2. Read the issue and board state
3. Identify the product repository
4. Switch to the product repository if implementation is required
5. Make the change there
6. Return here to update issue evidence, board state, and shared docs

## Required Reading

1. [docs/WIKI.md](docs/WIKI.md)
2. [docs/PROJECT_MANAGEMENT.md](docs/PROJECT_MANAGEMENT.md)
3. [docs/PROJECT_REPOSITORIES.md](docs/PROJECT_REPOSITORIES.md)
4. [docs/COMMAND_ACCESS_POLICY.md](docs/COMMAND_ACCESS_POLICY.md)
5. [docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md)
6. [docs/UI_UX_STANDARDS.md](docs/UI_UX_STANDARDS.md)

## Managed Projects

- amanoba
- cardmass
- hatori
- kormanyvalto
- launchmass
- messmass
- narimato
- reply
- sentinelsquad
- sso

Each project has a dedicated page under `docs/projects/`.

## Board Workflow

- **Source of Truth**: GitHub Issues + GitHub Project Board
- **Board URL**: https://github.com/users/moldovancsaba/projects/1

### Status Flow

1. Backlog → Ready → In Progress → Review → Done
2. Blocked (when encountering blockers)

### Core Fields

- Status: lifecycle stage
- Agent: current owner/executor
- Product: target repository
- Type: feature, bug, docs, refactor, release
- Priority: critical, high, medium, low

## Non-Negotiables

- Do not bypass the board for delivery work
- Do not treat this repository as the implementation home for unrelated products
- Do not hide cross-project rules inside one product repo
- Do not leave shared docs stale when global behavior changes
- Do not use placeholders or unverified content
- Do not leave builds with warnings, errors, or deprecated APIs

## Commands

Check `docs/COMMAND_ACCESS_POLICY.md` for command execution policies.

## Documentation Standards

- Documentation is part of the deliverable, not follow-up work
- No TBD, placeholder copy, or filler
- If it is not documented, it is not done

## Next Steps for New Developers

1. Clone the repository
2. Set up Docker environment with `docker-compose up -d`
3. Read the required documentation listed above
4. Pick a starter task from the board
5. Follow the working model to complete tasks
