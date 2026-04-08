# Market Research: MVP Factory Control

## Company Overview

**MVP Factory Control** is a portfolio management system designed to orchestrate delivery across multiple product projects. It serves as the central control layer for a portfolio of interconnected software products.

## Core Value Proposition

- **Portfolio Governance**: Defines shared delivery rules, standards, prompts, and documentation
- **Portfolio Tracking**: Keeps every delivery item visible as issues and board items  
- **Portfolio Routing**: Directs implementation work into correct product repositories
- **Portfolio Tooling**: Hosts internal control apps and scripts supporting delivery operations

## Target Market

### Primary Users
- Internal development teams building multiple concurrent products
- Solo entrepreneurs managing multiple SaaS/MVP projects
- Small agencies delivering client projects across multiple repositories

### Managed Projects Portfolio
The system currently manages 10 product repositories:
1. amanoba
2. cardmass
3. hatori
4. kormanyvalto
5. launchmass
6. messmass
7. narimato
8. reply
9. sentinelsquad
10. sso

## Market Pain Points Addressed

1. **Coordination Complexity**: Managing delivery across multiple repos is fragmented
2. **Standards Drift**: Each project develops its own conventions over time
3. **Visibility Gaps**: No single view of portfolio-wide delivery status
4. **Agent/Operator Friction**: No clear operating model for automated delivery

## Competitive Landscape

### Similar Solutions
- GitHub Organizations with Projects (generic, no portfolio-specific tooling)
- Linear/Jira (single-project focus, no repo orchestration)
- Custom internal frameworks (maintenance burden)

### Differentiation
- Agent-native workflow designed for AI-assisted delivery
- Explicit repo boundary rules and routing logic
- Built-in coding/UI/UX standards enforcement
- Internal control app for operator workflows

## Technical Approach

### Architecture
- Central control repo (this repository)
- Product repos for implementation
- GitHub Issues as source of truth
- GitHub Projects for visual tracking

### Key Features
- Issue-driven delivery model
- Shared prompts and agent operating guidance
- Cross-project standards and documentation
- Board automation scripts

## Growth Indicators

- 10 active managed projects
- Multi-project support demonstrated
- Established documentation and standards framework

## Market Positioning

**Position**: Portfolio orchestration layer for multi-repo product development

**Ideal Customer**: Developers/agencies managing 3+ concurrent software products who want standardized delivery across their portfolio.

## Notes

This market research was conducted as part of MVP-19 to establish baseline understanding of the MVP Factory Control system for future marketing and growth initiatives.
