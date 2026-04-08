# MVP Factory Pipeline

**Scope:** Process pipeline description. Technical automation for the control repository is implemented in `scripts/` and `apps/mvp-factory-control` (see [READMEDEV.md](READMEDEV.md)).

## Overview

This document describes the pipeline for turning ideas into delivered MVPs. Every deliverable must be approved by the executive committee (CEO, CMO, CTO) before implementation begins.

## Pipeline Stages

### Stage 1: Idea Capture

**Actors:** Product Employee

- Product employee identifies opportunities or receives input from customers, market research, or internal teams
- Document idea in the standard idea template with:
  - Problem statement
  - Proposed solution
  - Target users/customer segment
  - Expected business value
  - Initial technical considerations (if known)

### Stage 2: Technical Feasibility & Prioritization

**Actors:** Product Employee + Senior Full Stack Developer

- Product employee and senior full stack developer collaborate to:
  - Assess technical feasibility
  - Estimate effort and complexity
  - Identify dependencies and risks
  - Determine initial priority score
- Together they refine the idea and document technical approach
- Senior full stack developer provides tech stack recommendations

### Stage 3: Executive Committee Review

**Actors:** CEO, CMO, CTO

- Product employee submits the refined idea to the executive committee
- Each executive reviews from their perspective:
  - **CEO:** Company strategy, resource allocation, strategic fit
  - **CMO:** Market positioning, customer value, marketing opportunities
  - **CTO:** Technical feasibility, architecture alignment, technical debt impact
- Committee approves, requests revisions, or rejects

### Stage 4: Approved for Development

**Actors:** Product Employee + Senior Full Stack Developer

- Once approved, the idea moves to the development backlog
- Senior full stack developer creates technical specification
- Product employee finalizes requirements and acceptance criteria

### Stage 5: Implementation

**Actors:** Senior Full Stack Developer + Engineering Team

- Senior full stack developer leads implementation
- Works with product employee for clarification during development
- Follows MVP Factory quality standards

### Stage 6: Delivery & Review

**Actors:** Product Employee + Senior Full Stack Developer + Executive Committee

- Delivered MVP is reviewed by product employee against acceptance criteria
- Executive committee does final review
- Lessons learned are documented for future improvements

## Approval Gates

| Stage | Gate | Approvers |
|-------|------|-----------|
| Stage 2 → Stage 3 | Technical sign-off | Senior Full Stack Developer |
| Stage 3 → Stage 4 | Executive approval | CEO + CMO + CTO (all required) |

## Key Principles

1. **No work begins without executive approval** — Every deliverable must have sign-off from all three executives
2. **Collaboration is mandatory** — Product and engineering work together from Stage 2 onwards
3. **Single source of truth** — All ideas and their status are tracked in the MVP Factory project board
4. **Transparency** — Pipeline status is visible to all stakeholders

## Related Documents

- [MVP Factory Playbook](./mvp_factory_playbook.md) — Comprehensive guide covering what, how, when, and why we do what we do
