# GMVGANG Proprietary Platform Roadmap

## Objective

Build proprietary software that improves revenue, delivery quality, operating leverage or defensible data advantages without replacing Notion as the operational source of truth.

The platform will evolve toward an agency-native TikTok Shop Affiliate OS. Cruva is used as a benchmark for workflow coverage, while GMVGANG builds its own architecture, UI, data model and business logic around agency operations, profitability, compliance and AI-assisted decisioning.

See `docs/CRUVA-CAPABILITY-MAP.md` for the detailed capability benchmark and sequencing.

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
        +--> Creator Operations
        +--> Workflow Automation
        +--> Content Intelligence
        +--> Compliance
        +--> Affiliate Analytics
        |
        v
AI Decision Layer
        |
        +--> Internal Ops / Growth Cockpit
        +--> Brand Portal
        +--> Creator Portal
        +--> API / MCP
```

## Engineering principles

1. Revenue validation before broad platform work.
2. Notion remains the operational SSOT; no disconnected parallel CRM.
3. Business logic is UI-independent, deterministic where possible and covered by tests.
4. Scores and recommendations must be explainable.
5. Founder-level thresholds and weights stay configurable until explicitly standardized.
6. Never commit secrets, customer data or creator personal data.
7. External platform actions use authorized integrations only.
8. High-impact actions require explicit approval gates until reliability is proven.
9. Multi-brand / client isolation is a first-class architectural requirement.
10. Build defensible intelligence; integrate commodity infrastructure.

## Product sequence

### Phase 1 - Revenue Core

- [x] Product Economics Core
- [x] Target Contribution Margin Guardrail
- [x] Pilot Scenario Comparison
- [x] Brand Qualification Engine
- [x] Pilot Generator

### Phase 2 - Creator Operations MVP

- [ ] Multi-brand workspace foundation
- [ ] Creator data model / creator graph
- [ ] Creator Matching Engine
- [ ] Creator Performance Score
- [ ] Creator lists / segments
- [ ] Outreach campaign model
- [ ] Sample request pipeline
- [ ] Basic affiliate performance dashboard
- [ ] Notion synchronization contracts
- [ ] Audit log

### Phase 3 - Automation Layer

- [ ] Workflow engine: trigger -> condition -> action
- [ ] Follow-up automation
- [ ] Auto-replies
- [ ] Sample approval rules
- [ ] Re-engagement workflows
- [ ] Cross-brand workflow templates
- [ ] AI-assisted outreach personalization

### Phase 4 - Proprietary Intelligence

- [ ] Natural-language creator search
- [ ] Lookalike creator discovery
- [ ] Competitor / product creator intelligence from authorized sources
- [ ] Sales Intelligence
- [ ] Content Intelligence Engine
- [ ] Creative Testing System
- [ ] Compliance Engine
- [ ] Creator retention analytics
- [ ] Benchmark foundations
- [ ] Forecasting and Scaling Gates

### Phase 5 - Growth Cockpit + Interfaces

- [ ] Growth Cockpit
- [ ] Affiliate funnel reporting
- [ ] Sample funnel reporting
- [ ] Campaign profitability / contribution margin
- [ ] Brand Portal
- [ ] Creator Portal
- [ ] API / Integration Layer

### Phase 6 - Community + Paid Media Operations

- [ ] Creator community / tiers
- [ ] Contests / leaderboards / rewards
- [ ] Reactivation campaigns
- [ ] Usage-rights management
- [ ] Licensed-content / UGC library
- [ ] Spark-code workflow where officially supported
- [ ] TikTok paid-media handoff
- [ ] Meta partnership-ad workflow

### Phase 7 - Agentic Operations

- [ ] GMVGANG Copilot
- [ ] MCP server
- [ ] Automated Growth Analyst
- [ ] Agency Autopilot with approval gates

## Current gate

Phase 1 Revenue Core is implemented.

The next build target is Phase 2 Creator Operations MVP, starting with the creator data model / creator graph and Creator Matching Engine. The first milestone is not a broad SaaS dashboard: it is a real GMVGANG client campaign that can move from product -> creator shortlist -> outreach -> sample -> post -> GMV with less manual work than the current process.

Any dashboard, portal or automation must either remove a measured operational blocker, improve revenue decisions, improve delivery quality or generate defensible data.
