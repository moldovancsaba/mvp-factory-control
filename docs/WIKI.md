# Wiki

This is the main navigation page for `mvp-factory-control`.

**Code and docs alignment:** Implementation behavior for the internal app lives under `apps/mvp-factory-control`. Every TypeScript module and major script includes a top-of-file comment describing scope; the maintainer index table is in [../READMEDEV.md](../READMEDEV.md) (section **Source map**). When you change behavior, update that module’s comment and any doc linked from this wiki in the same change.

Select "🌐 Open Dashboard" to access `http://localhost:3100`.

## Start Here

- [../README.md](../README.md)
- [../READMEDEV.md](../READMEDEV.md)

## Operating System

- [PROJECT_MANAGEMENT.md](PROJECT_MANAGEMENT.md)
- [PROJECT_REPOSITORIES.md](PROJECT_REPOSITORIES.md)
- [COMMAND_ACCESS_POLICY.md](COMMAND_ACCESS_POLICY.md)
- [INTERNAL_CONTROL_APP.md](INTERNAL_CONTROL_APP.md)
- [BUILD_AND_RUN.md](BUILD_AND_RUN.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [EVOLUTION.md](EVOLUTION.md)
- [GENERAL_KNOWLEDGE.md](GENERAL_KNOWLEDGE.md)
- [AGENT_PROMPTS.md](AGENT_PROMPTS.md)

## Standards

- [CODING_STANDARDS.md](CODING_STANDARDS.md)
- [UI_UX_STANDARDS.md](UI_UX_STANDARDS.md)
- [RULES.md](RULES.md)

## Process And Setup

- [SETUP.md](SETUP.md)
- [SYNC.md](SYNC.md)
- [EXECUTABLE_PROMPT_PACKAGE.md](EXECUTABLE_PROMPT_PACKAGE.md)

## Project Catalog

- [projects/amanoba.md](projects/amanoba.md)
- [projects/cardmass.md](projects/cardmass.md)
- [projects/hatori.md](projects/hatori.md)
- [projects/kormanyvalto.md](projects/kormanyvalto.md)
- [projects/launchmass.md](projects/launchmass.md)
- [projects/messmass.md](projects/messmass.md)
- [projects/narimato.md](projects/narimato.md)
- [projects/reply.md](projects/reply.md)
- [projects/sentinelsquad.md](projects/sentinelsquad.md)
- [projects/sso.md](projects/sso.md)

## Product Pages

Each product page defines:

- the local repository path
- the implementation boundary
- what work stays in `mvp-factory-control`
- what work moves into the product repository

- **Orchestrator**: `localhost:3100` (Paperclip)
- **Assistant**: `localhost:18789` (OpenClaw)
- **Inference**: `localhost:11434` (Ollama)
- **Control**: `localhost:3577` (Web App)
