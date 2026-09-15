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
- [x] Campaign readiness gate: client approval + creator contract/compliance/eligibility
- [ ] Basic affiliate performance dashboard
- [x] Notion Creator synchronization contract
- [x] Company OS Campaign / Assignment SSOT
- [x] Hosted internal Campaign Cockpit foundation
- [x] PII-minimized Company OS -> Cockpit sync
- [x] Persistent Railway runtime snapshot store with restart restore
- [x] 30-minute stale-sync warning in Campaign Cockpit
- [x] Audit log

### Phase 3 - Automation Layer

- [x] Scheduled read-only Company OS -> Cockpit sync
- [x] Approval-gated initial outreach adapter foundation with idempotency contract
- [ ] Persistent production idempotency store
- [ ] Authorized outreach transport (Gmail / TikTok / Make)
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

Phase 1 Revenue Core is implemented. Phase 2 now includes the creator graph, performance scoring, deterministic product-to-creator matching, reusable creator segmentation / materialized lists, the PII-minimized Notion Creator synchronization contract, Company OS campaign execution sources, the Campaign Execution Core and a fail-closed Campaign Readiness Gate.

The internal Campaign Cockpit is hosted on Railway behind HTTP Basic authentication. A Make scenario reads the Company OS every 15 minutes and sends read-only snapshots through a separate machine-secret boundary. Creator reads are restricted to the explicit operational whitelist `TikTok Handle`, `Status`, `Legal Hold`, `Creator nicht aufnehmen`, `Raus`, `Compliance-Risiko`, `TikTok Verstöße 90 Tage`, `Compliance Check bestanden` and `Vertrag unterschrieben am`; the runtime applies the same whitelist again before storing the snapshot. No contact details, addresses, tax data or contract contents enter the Cockpit store.

The Cockpit runtime is now backed by a Railway volume mounted at `/data`. Sanitized creator, campaign and assignment snapshots are written atomically and replayed into the runtime after restart. Production recovery was verified by synchronizing all three sources, disabling Make, redeploying the service, and observing `creators,campaigns,assignments` restore from disk before any new HTTP sync. The UI also evaluates source freshness and warns when a required Company OS snapshot is older than 30 minutes or has no valid sync timestamp.

The Company OS Campaign SSOT contains the campaign-specific `Client Approved` gate. Creator contract, compliance and eligibility facts remain in the central Creator SSOT and are derived into a read-only campaign readiness snapshot instead of being duplicated on assignments. `approveCampaign`, `launchCampaign`, `resumeCampaign`, active execution functions and `getCampaignActionQueue` all fail closed when readiness is not green.

The first outbound integration boundary is implemented as `@gmvgang/campaign-outbound`. It accepts only an active, readiness-green `send-outreach` action plus explicit human approval, claims a deterministic campaign+creator idempotency key before any transport call, detects message-template conflicts, reconciles verified provider receipts back into the Campaign Execution Core, and locks ambiguous provider failures as `uncertain` rather than retrying automatically. Dispatch requests carry creator/campaign references but no raw contact PII. No production idempotency persistence or real transport is connected yet, so this increment cannot send an external message.

The first Company OS campaign remains `kaëll – PUNKTLANDUNG – Pre-Launch Validation`: an internal Draft with three real Screening creator assignments. kaëll is not yet a won client, `Client Approved` remains off, and the assigned creators have not cleared all contract / execution-eligibility gates. The Cockpit therefore shows readiness blockers and produces no outreach, sample or content action queue.

The next reliability gate is complete Notion pagination beyond 100 rows so Company OS snapshots cannot silently truncate as the Creator pool grows. After that: verified affiliate-performance ingestion and the first basic affiliate performance dashboard. The persistent production idempotency store and any authorized outbound transport remain separate, approval-gated future increments.

Any dashboard, portal or automation must either remove a measured operational blocker, improve revenue decisions, improve delivery quality or generate defensible data.
