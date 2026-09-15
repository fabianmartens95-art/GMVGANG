# Company OS Campaign Sync Contract

## Purpose

Keep Notion / GMVGANG Company OS as the operational source of truth while allowing the hosted Campaign Cockpit to project campaign execution without storing Creator PII in GitHub or the browser bundle.

## Company OS data sources

### Existing Creator master

The existing central Creator database remains the only Creator master source. Campaign operations reference Creator pages instead of copying Creator records.

The runtime sync is allowed to read only the following Creator fields:

- TikTok Handle
- Creator-Tier
- Status
- Kategorie
- Account-Region
- Content-Format
- Follower
- Compliance-Risiko
- Legal Hold
- Creator nicht aufnehmen
- Raus
- TikTok Verstöße 90 Tage

It must not sync e-mail, phone / WhatsApp, addresses, tax data, invoices, contracts, signatures or other billing/legal payloads.

### GMVGANG – Campaigns

Canonical campaign-level execution state:

- Campaign / Campaign Key
- Brand Key
- Product Key
- Creator List Key
- Status
- Created / Approved / Launched / Completed timestamps
- GMV / Orders / Commission
- Cockpit Sync

Only rows with `Cockpit Sync = checked` are eligible for the hosted cockpit.

### GMVGANG – Campaign Creator Assignments

Canonical creator-to-campaign execution state:

- Campaign relation
- Creator relation to the central Creator database
- Creator Key
- Outreach Status / Reply / Sent At / Next Follow-up / Follow-up Count
- Sample Status and operational timestamps
- Content Status / Briefed At / Posted At / Content Reference
- GMV / Orders / Commission
- Cockpit Sync

No shipping address or other Creator PII belongs in this database.

## Runtime boundary

```text
Company OS
  -> sanitized read-only sync
  -> hosted Campaign Cockpit runtime
  -> CampaignLedger projection
  -> read-only UI
```

The hosted runtime never writes back to Notion in this increment.

## Security controls

- UI protected by HTTP Basic authentication in production.
- Sync endpoint protected by a separate high-entropy secret.
- Sync endpoint accepts only the three known source names: creators, campaigns, assignments.
- Payload size is capped.
- No secrets are committed to GitHub.
- No external messages, sample orders or Notion writes are executed from the cockpit.

## Fallback behavior

Creator source and campaign source are reported separately.

- If no Creator snapshot has arrived, Creator source is shown as pending.
- If Creator data is live but no real synced campaign exists yet, the cockpit shows the live Creator pool while keeping campaign cards on clearly labeled state-machine demo data.
- Once at least one Company OS campaign and its assignments are synced, campaign cards switch to Company OS live data.

This prevents demo metrics from being presented as live operational facts.
