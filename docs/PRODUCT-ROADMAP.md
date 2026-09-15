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
        +--> Campaign Execution
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
- [x] Creator data model / creator graph
- [x] Creator Matching Engine core
- [x] Creator Performance Score
- [x] Creator lists / segments
- [x] Outreach campaign model
- [x] Sample request pipeline
- [ ] Basic affiliate performance dashboard
- [x] Notion Creator synchronization contract
- [x] Company OS Campaign / Assignment SSOT
- [x] Hosted internal Campaign Cockpit foundation
- [x] PII-minimized Company OS -> Cockpit sync
- [x] Audit log

### Phase 3 - Automation Layer

- [x] Scheduled read-only Company OS -> Cockpit sync
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

- [x] Internal Campaign Cockpit foundation
- [ ] Full Growth Cockpit
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

Phase 1 Revenue Core is implemented. Phase 2 now includes the creator graph, performance scoring, deterministic product-to-creator matching, reusable creator segmentation / materialized lists, the PII-minimized Notion Creator synchronization contract, Company OS campaign execution sources and the Campaign Execution Core.

The internal Campaign Cockpit is hosted on Railway behind HTTP Basic authentication. A Make scenario reads the Company OS every 15 minutes and sends read-only snapshots through a separate machine-secret boundary. Creator reads are restricted to the explicit operational whitelist `TikTok Handle`, `Status`, `Legal Hold`, `Creator nicht aufnehmen`, `Raus`, `Compliance-Risiko` and `TikTok Verstöße 90 Tage`; the runtime applies the same whitelist again before storing the snapshot.

The Creator pool is live from Company OS. The first Company OS campaign is now synchronized through the production path: `kaëll – PUNKTLANDUNG – Pre-Launch Validation` is an explicitly internal Draft with three real Screening creator assignments. The verified Make run sent 1 campaign and 3 assignments to the Railway runtime with HTTP 200. Because kaëll is not yet a won client and the assigned creators have not all cleared activation / contract gates, outreach remains `Queued`, samples remain `Not Requested`, content remains `Not Started`, and the Draft produces no external action queue.

The next gate is client approval plus creator eligibility / contract gates, followed by the first real end-to-end execution through outreach -> sample -> content -> GMV. After that: verified affiliate-performance ingestion, multi-brand isolation, a persistent runtime store and approval-gated outbound adapters. External messages, sample fulfillment and Notion writes remain outside the Cockpit runtime until explicitly approved and implemented.

Any dashboard, portal or automation must either remove a measured operational blocker, improve revenue decisions, improve delivery quality or generate defensible data.
