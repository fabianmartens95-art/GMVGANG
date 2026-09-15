# GMVGANG Affiliate OS — Cruva Capability Map

## Objective

Build GMVGANG-owned software with the highest-value capabilities of modern TikTok Shop affiliate operating systems such as Cruva, adapted for an agency operating multiple client brands.

This is a capability benchmark, not a pixel clone or reverse-engineering project. GMVGANG will implement its own workflows, UI, data model and business logic using authorized integrations only.

## Architectural constraint

Notion / GMVGANG Company OS remains the operational Single Source of Truth for current business operations.

The proprietary platform becomes the intelligence, automation and execution layer:

```text
TikTok Shop / approved data sources / email / ads / commerce
                         |
                         v
              GMVGANG Integration Layer
                         |
          +--------------+--------------+
          |              |              |
          v              v              v
      Creator Graph   Workflow Engine   Analytics
          |              |              |
          +--------------+--------------+
                         |
                         v
                 AI Decision Layer
                         |
       +-----------------+------------------+
       |                 |                  |
       v                 v                  v
 Internal Cockpit    Brand Portal      Creator Portal
                         |
                         v
                 Notion synchronization
```

Do not create a second manual CRM that competes with Company OS. Data that is operationally relevant should synchronize back to the existing GMVGANG data model.

## Capability domains

### 1. Agency Workspace / Multi-Shop

Target capabilities:

- Multiple client brands and TikTok Shops in one workspace
- Per-brand data isolation
- Role-based access for Owner / Admin / Operator / Client
- Team members restricted to specific brands
- Region / market support
- Brand-level settings, integrations and thresholds
- Client-facing reporting view

Why it matters for GMVGANG:

GMVGANG is an agency, so multi-tenant architecture is a core requirement rather than an add-on.

### 2. Creator Intelligence

Target capabilities:

- Search creators by niche, market, product fit and performance
- Natural-language creator search
- Lookalike creators based on proven winners
- Competitor creator discovery
- Product-to-creator matching
- Creator scoring
- Creator performance history
- Saved lists / segments
- Explainable match reasons

GMVGANG differentiator:

Combine performance fit with our own economics, compliance and brand-fit scoring rather than ranking only by GMV or followers.

### 3. Creator CRM View

Target capabilities:

- Unified creator profile
- Lifecycle stage
- Contact history
- Brand relationships
- Sample history
- Content history
- GMV / orders / conversion / post frequency
- Notes, tags and segments
- Retention / reactivation status

Constraint:

The software should read/write the canonical operational record through Company OS synchronization instead of becoming a disconnected second database.

### 4. Outreach Automation

Target capabilities:

- Personalized outreach sequences
- Email sequences
- TikTok Shop collaboration / DM actions where officially supported
- Follow-ups
- Auto replies based on conditions
- Stop-on-reply logic
- Rate limits and sending windows
- Creator-specific personalization
- Campaign-level statistics
- Re-engagement sequences

Key metrics:

- Sent
- Delivered
- Opened where available
- Replied
- Accepted
- Sample requested
- Posted
- Sold
- GMV

### 5. Workflow Engine

Target capabilities:

Trigger -> condition -> action workflows, for example:

```text
Creator joins campaign
  -> if 30d GMV >= threshold
     -> approve sample
     -> send briefing
     -> wait 5 days
     -> if no post
        -> send reminder
```

Required primitives:

- Event triggers
- Scheduled / recurring triggers
- Conditions with AND / OR
- Wait / wait-until steps
- Branches
- Actions
- Human approval gates
- Audit log
- Per-step activity
- Workflow templates
- Cross-brand reusable workflow skeletons without leaking brand-specific copy or IDs

### 6. Sample Operations

Target capabilities:

- Inbound sample request queue
- Eligibility rules
- Auto-approve / reject rules
- Inventory visibility before approval
- Shipping / fulfillment status
- Received status
- Content due state
- Reminder automation
- Sample-to-post conversion funnel
- Sample-to-GMV attribution

GMVGANG differentiator:

Sample approval should include contribution-margin and expected-value checks, not creator size alone.

### 7. Campaign Operations

Target capabilities:

- Campaign creation
- Brand / product assignment
- Creator cohort
- Commission / incentive rules
- Briefs
- Deliverables
- Retainers
- Contests
- Leaderboards
- Races / challenges
- Reactivation campaigns
- Campaign GMV and profitability

### 8. Content Intelligence

Target capabilities:

- Affiliate video library
- LIVE library
- Performance by video / creator / product
- Top hooks and formats
- Creative tagging
- Winning-angle detection
- Creator briefs generated from proven content
- Keyword / compliance scans
- Creative test tracking
- UGC library

GMVGANG differentiator:

Use the existing Content Intelligence, Creative Testing and Compliance roadmap components as one shared engine rather than separate tools.

### 9. Affiliate Analytics / Growth Cockpit

Target capabilities:

- Affiliate GMV
- Orders / units
- Commission
- Video count
- LIVE performance
- Creator activation funnel
- Sample funnel
- Top creators
- Top products
- Top videos
- Creator retention cohorts
- Repeat post rate
- Time-to-first-post
- GMV per sampled creator
- Campaign profitability
- Contribution margin
- Ad spend / ROI where available
- Brand and cross-brand benchmarks

GMVGANG differentiator:

Tie all growth metrics to the existing Product Economics Core and Aligned Growth guardrails.

### 10. Ads / Usage Rights

Target capabilities:

- Usage-rights requests
- Rights status and expiry
- Creator payout tracking
- Licensed-content library
- Spark-code collection where supported
- TikTok ad handoff
- Meta partnership-ad handoff
- Top-creative boost recommendations
- ROI tracking

All external actions require explicit permissions and appropriate approval gates.

### 11. Creator Community

Target capabilities:

- Creator groups / tiers
- Inner-circle programs
- Campaign hub
- Rewards
- Contests and leaderboards
- Milestone messages
- Re-activation
- Broadcasts
- Discord / community integration where useful
- Lifetime GMV and repeat-post tracking

Goal:

Increase creator retention and turn one-off affiliates into repeat producers.

### 12. AI Copilot

Target capabilities:

Natural-language access to agency data, e.g.:

- "Which creators produced > €500 GMV but have not posted in 30 days?"
- "Which open samples should we approve based on our rules?"
- "Summarize this client's month."
- "Find the top 20 creators for this new product."
- "Which creative angles are currently driving the best contribution margin?"

Copilot should initially be read-heavy. High-impact writes such as sending messages, approving samples, changing budgets or paying creators require explicit approval gates.

### 13. API / MCP Layer

Target capabilities:

- Authenticated API
- Brand-scoped credentials
- Role / permission scopes
- Read APIs for creators, products, campaigns, videos, samples and analytics
- Controlled write APIs for approved workflows
- MCP server so ChatGPT / other authorized agents can operate on live GMVGANG data
- Audit logging for agent actions

This is a strategic capability because it makes the platform usable by AI agents without coupling business logic to one UI.

## Prioritization

### P0 — Creator Operations MVP

Build first:

1. Multi-brand workspace foundation
2. Creator data model / creator graph
3. Creator Matching Engine
4. Creator Performance Score
5. Lists / segments
6. Outreach campaign model
7. Sample request pipeline
8. Basic affiliate performance dashboard
9. Notion synchronization contracts
10. Audit log

Done when GMVGANG can run a real client creator campaign through the system with less manual work than the current process.

### P1 — Automation Layer

1. Workflow engine
2. Follow-up automation
3. Auto-replies
4. Sample approval rules
5. Re-engagement automation
6. Reusable workflow templates
7. AI-assisted outreach personalization

Done when repetitive creator operations can run with human approval only at defined gates.

### P2 — Intelligence Layer

1. Natural-language creator search
2. Lookalike creator discovery
3. Competitor / product creator intelligence using authorized data sources
4. Content Intelligence
5. Creative testing
6. Retention analytics
7. Profitability / contribution-margin analytics
8. Benchmarks

### P3 — Community + Ads

1. Creator community hub
2. Contests / leaderboards / rewards
3. Usage-rights management
4. Spark / paid-content handoff
5. Meta partnership-ad workflow
6. UGC library

### P4 — Agentic Platform

1. GMVGANG Copilot
2. Public/internal API
3. MCP server
4. Automated weekly growth analyst
5. Agency Autopilot with approval gates

## Build-vs-integration rule

Build proprietary logic where it creates defensibility:

- Creator matching
- Creator performance scoring
- Economics
- Profitability guardrails
- Campaign decisioning
- Content intelligence
- Benchmarks
- AI orchestration

Integrate commodity infrastructure where possible:

- Authentication
- Email delivery
- File storage
- Payments
- Notifications
- Approved TikTok / Meta APIs

## Compliance / platform constraint

Do not imitate private implementation details, scrape protected interfaces, bypass TikTok limits or automate unsupported actions. TikTok Shop access, creator messaging, sample actions, ads and shop data must use authorized APIs, partner permissions or user-authorized integrations.

## Product principle

Cruva is the benchmark for workflow coverage. GMVGANG should aim to win on agency-native execution, profitability intelligence, explainable creator matching, compliance and AI-assisted decisioning rather than feature-for-feature copying for its own sake.
