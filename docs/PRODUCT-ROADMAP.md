# GMVGANG Proprietary Platform Roadmap

## Objective

Build proprietary software that improves revenue, delivery quality, operating leverage or defensible data advantages without replacing Notion as the operational source of truth.

## Architecture

```text
Notion / Operational SSOT
        |
        v
GMVGANG Data + Integration Layer
        |
        +--> Economics
        +--> Brand Qualification
        +--> Creator Matching
        +--> Content Intelligence
        +--> Compliance
        |
        v
AI Decision Layer
        |
        +--> Internal Ops
        +--> Brand Portal
        +--> Creator Portal
```

## Engineering principles

1. Revenue validation before broad platform work.
2. Notion remains the operational SSOT; no parallel CRM.
3. Business logic is UI-independent, deterministic where possible and covered by tests.
4. Scores and recommendations must be explainable.
5. Founder-level thresholds and weights stay configurable until explicitly standardized.
6. Never commit secrets, customer data or creator personal data.

## Product sequence

### Phase 1 - Revenue Core

- [x] Product Economics Core
- [x] Target Contribution Margin Guardrail
- [x] Pilot Scenario Comparison
- [ ] Brand Qualification Engine
- [ ] Pilot Generator

### Phase 2 - Proprietary Intelligence

- [ ] Creator Matching Engine
- [ ] Creator Performance Score
- [ ] Sales Intelligence
- [ ] Benchmark foundations

### Phase 3 - Delivery Intelligence

- [ ] Content Intelligence Engine
- [ ] Creative Testing System
- [ ] Compliance Engine
- [ ] Forecasting and Scaling Gates

### Phase 4 - Interfaces

- [ ] Growth Cockpit
- [ ] Brand Portal
- [ ] Creator Portal
- [ ] API / Integration Layer

### Phase 5 - Agentic Operations

- [ ] Automated Growth Analyst
- [ ] Agency Autopilot

## Additional long-term capabilities

The platform may also evolve into a campaign operating system, a pilot generator, anonymized benchmark database and shared decision layer for GMVGANG-owned workflows.

## Current gate

The next active component is the Brand Qualification Engine because it can directly support lead prioritization, sales qualification and pilot suitability. Broad dashboards and portals remain deferred until they solve a measured operational blocker or the current revenue-validation gate ends.
