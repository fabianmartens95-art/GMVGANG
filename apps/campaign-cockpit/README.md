# GMVGANG Campaign Cockpit

Internal operational cockpit for campaign execution. The UI projects data from `@gmvgang/campaign-operations` instead of duplicating campaign business logic.

## Runtime architecture

```text
Notion Company OS (SSOT)
  ├─ Creator master data
  ├─ Campaigns
  └─ Campaign Creator Assignments
          |
          | sanitized read-only sync
          v
Campaign Cockpit runtime
  ├─ Basic-auth protected web UI
  ├─ /api/snapshot
  └─ /api/sync/raw/{creators|campaigns|assignments}
          |
          v
Campaign Execution view model
```

The runtime accepts only campaign-operational fields required by the cockpit. E-mail addresses, phone numbers, addresses, tax data, contracts and other creator PII are not part of the sync contract.

## Live sync status

The production sync is handled by the Make scenario `GMVGANG – Company OS → Campaign Cockpit Sync v2` every 15 minutes.

Creator reads are restricted at the Notion API boundary to the operational whitelist used by the cockpit:

- TikTok Handle
- Status
- Legal Hold
- Creator nicht aufnehmen
- Raus
- Compliance-Risiko
- TikTok Verstöße 90 Tage

The runtime applies the same Creator-property whitelist again before storing the snapshot in memory. Campaigns and Campaign Creator Assignments use dedicated non-PII Company OS data sources.

## Data modes

- Creator pool: switches to `Company OS Live` as soon as a sanitized creator snapshot is received.
- Campaigns: use live Company OS Campaigns + Assignments when at least one synced campaign exists.
- Until the first real campaign is synced, campaign cards continue to use the state-machine-generated demo data and are explicitly labeled as demo.

This hybrid fallback keeps the UI usable without pretending that demo campaign metrics are live.

## Security

- Browser access is protected with HTTP Basic auth when `COCKPIT_BASIC_PASSWORD` is set.
- Sync endpoints require `X-Cockpit-Sync-Secret` and do not accept browser Basic auth as a substitute.
- `/health` is intentionally unauthenticated for hosting health checks.
- Sync payloads are capped at 5 MB.
- The cockpit remains read-only: it cannot send messages, approve samples, order products or mutate Notion.
- External actions remain behind explicit approval and adapter boundaries.

## Company OS data sources

The Company OS now contains dedicated campaign execution sources:

- `GMVGANG – Campaigns`
- `GMVGANG – Campaign Creator Assignments`

Assignments reference the existing central Creator database instead of duplicating Creator master data.

Only rows with `Cockpit Sync = checked` are projected into live campaign execution.

## Development

```bash
pnpm --filter @gmvgang/campaign-cockpit dev
```

Production build + runtime:

```bash
pnpm --filter @gmvgang/campaign-cockpit build
pnpm --filter @gmvgang/campaign-cockpit start
```

See `.env.example` for the runtime configuration contract.
