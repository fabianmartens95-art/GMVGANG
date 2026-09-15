# GMVGANG Campaign Cockpit

Internal operational cockpit for campaign execution. The UI projects data from `@gmvgang/campaign-operations` instead of duplicating campaign business logic.

## MVP scope

- portfolio GMV / order / commission rollup
- campaign status and health overview
- creator-level outreach, sample and content state
- approval-gated action queue
- blocker surfacing
- sample-to-post and acceptance funnel metrics
- audit-trail event count
- responsive desktop/mobile layout

## Current data mode

The first UI increment ships with synthetic demo ledgers generated through the real campaign state machine. No creator PII is present. The view model is ready to accept real `CampaignLedger` snapshots once the Company OS / campaign sync adapter is connected.

## Safety

This cockpit is read-only. It does not send creator messages, approve or order samples, mutate Notion records, or execute external platform actions. Those effects remain behind explicit approval and adapter boundaries.

## Development

```bash
pnpm --filter @gmvgang/campaign-cockpit dev
```
