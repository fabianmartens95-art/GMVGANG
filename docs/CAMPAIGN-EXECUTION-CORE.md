# GMVGANG Campaign Execution Core

## Objective

Provide the deterministic execution layer between creator intelligence and external campaign actions.

The core owns campaign state, creator assignment state, follow-up due state, sample workflow state, content/performance attribution and an append-only audit trail. It does not directly send creator messages, order samples, mutate TikTok Shop or commit external actions.

## Flow

```text
Creator Segment
    |
    v
Materialized Creator List
    |
    v
Campaign Draft
    |
    | human approval
    v
Campaign Active
    |
    +--> Outreach ready
    |      |
    |      +--> sent -> follow-up due -> reply
    |                              |
    |                              +--> accepted
    |                                      |
    |                                      v
    |                                Sample requested
    |                                      |
    |                                human approval
    |                                      |
    |                                      v
    |                           approved -> ordered -> shipped
    |                                      |
    |                                      v
    |                         delivered -> content due -> posted
    |                                                    |
    |                                                    v
    +----------------------------------------------> Performance
                                                         |
                                                         v
                                                     GMV / Orders
```

Every material state transition also appends an audit event.

## Safety model

External effects are deliberately separated from internal state transitions.

Examples:

- `send-outreach` means the campaign core has determined that outreach may be sent. It does not send a message.
- `send-follow-up` means a scheduled follow-up is due. It does not contact the creator.
- `approve-sample` requires a human approval before fulfillment.
- `fulfill-sample` indicates an approved sample can be handed to a fulfillment adapter.
- `content-reminder` indicates follow-up is operationally useful; sending remains approval-gated.

This lets Make, email, TikTok Shop and future API adapters execute only explicitly approved actions.

## Campaign state

Campaign statuses:

- `draft`
- `approved`
- `active`
- `paused`
- `completed`
- `cancelled` (reserved for a later cancellation command)

A campaign cannot launch directly from draft. `approveCampaign` must occur first.

## Outreach state

Per creator:

- `queued`
- `ready`
- `sent`
- `replied`
- `accepted`
- `declined`
- `stopped`

Follow-ups are scheduled as timestamps and surfaced through `getCampaignActionQueue`. The core records a follow-up as sent only after an external actor confirms it.

## Sample state machine

```text
not_requested
    -> requested
        -> approved
            -> ordered
                -> shipped
                    -> delivered
                        -> content_due
                            -> posted
                                -> closed
        -> rejected
            -> closed
```

Invalid transitions throw and therefore cannot silently corrupt campaign state.

## Content and performance

A creator can be briefed after outreach acceptance. Content posting is recorded with an external content reference. Performance is stored as an explicit snapshot with:

- GMV
- orders
- commission
- update timestamp

The core never fabricates performance. External adapters are responsible for supplying verified measurements.

## Audit trail

Audit events are append-only and sequenced per campaign:

```text
campaign-123:1
campaign-123:2
campaign-123:3
...
```

Each event records:

- campaign ID
- entity type and ID
- action
- timestamp
- human/system actor
- non-sensitive metadata

`validateAuditTrail` checks sequence, campaign linkage and event IDs.

## Metrics

`summarizeCampaign` currently exposes:

- creator count
- outreach sent
- replies
- accepted / declined
- reply rate
- acceptance rate
- samples requested
- samples delivered
- creators posted
- sample-to-post rate
- GMV
- orders
- commission

These are core metrics, not yet a dashboard.

## Current boundary with Notion

Notion / GMVGANG Company OS remains the operational Single Source of Truth for creator records and business operations.

The creator-intelligence package already provides the PII-minimized creator projection and materialized creator lists. The campaign-operations package consumes those lists as inputs.

This increment deliberately does not create a second manual CRM or write campaign status back to Notion. A later integration contract can synchronize approved campaign state into the existing Company OS structure once the canonical Campaign data model is defined there.

## Next integration increments

1. Campaign / product / brand synchronization contract with Company OS.
2. Approved outreach adapter.
3. Sample fulfillment adapter.
4. TikTok Shop / authorized performance ingestion.
5. Internal campaign cockpit built from the deterministic core.
