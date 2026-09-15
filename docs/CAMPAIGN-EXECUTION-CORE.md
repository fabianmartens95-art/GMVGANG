# GMVGANG Campaign Execution Core

## Objective

Provide the deterministic execution layer between creator intelligence and external campaign actions.

The core owns campaign state, creator assignment state, readiness gates, follow-up due state, sample workflow state, content/performance attribution and an append-only audit trail. It does not directly send creator messages, order samples, mutate TikTok Shop or commit external actions.

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
    +--> Readiness evaluation
    |      +--> Client approved?
    |      +--> Creator contract ready?
    |      +--> Creator compliance ready?
    |      +--> Creator execution eligible?
    |
    | all green + human approval
    v
Campaign Approved
    |
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

## Readiness gate

A draft is fail-closed by default. `evaluateCampaignReadiness` must establish an explicit readiness snapshot before approval.

Campaign-level evidence:

- client approval

Creator-level evidence for every assigned creator:

- contract ready
- compliance ready
- execution eligible

A campaign is ready only when the client gate and every assigned creator gate are green. Missing evidence is a blocker.

`approveCampaign` refuses a blocked draft. `launchCampaign` and `resumeCampaign` re-check readiness. Active execution helpers also require readiness, and `getCampaignActionQueue` returns no actions when readiness is false. This prevents a manually changed upstream status from bypassing the execution gate.

The readiness evaluation is recorded as `campaign.readiness_evaluated` in the audit trail with non-sensitive counts and boolean state.

## Company OS readiness sources

Notion / GMVGANG Company OS remains the operational Single Source of Truth.

Campaign-specific source:

- `GMVGANG – Campaigns`.`Client Approved`

Creator readiness remains derived from the central Creator SSOT rather than duplicated into campaign assignment records. The Cockpit runtime only receives the operational fields required for the gate:

- `TikTok Handle`
- `Status`
- `Legal Hold`
- `Creator nicht aufnehmen`
- `Raus`
- `Compliance-Risiko`
- `TikTok Verstöße 90 Tage`
- `Compliance Check bestanden`
- `Vertrag unterschrieben am`

No creator email, phone number, address, tax data, contract contents or signature payload is stored in the Cockpit runtime.

For the live read model, creator execution eligibility currently requires an `Onboarding` or `Aktiv` status plus no legal hold, manual exclusion or active TikTok violation. Compliance readiness requires the documented compliance check plus no legal/compliance blocker. Contract readiness requires a recorded signed-contract date.

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

A campaign cannot launch directly from draft. Readiness must be green, then `approveCampaign` must occur before `launchCampaign`.

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

The internal Campaign Cockpit renders these metrics together with readiness blockers and approval-gated actions.

## Current boundary with Notion

The Company OS contains the canonical Campaign and Campaign Creator Assignment sources. The Cockpit consumes read-only snapshots through Make and does not write operational status back to Notion.

Creator readiness facts remain in the existing Creator database. Campaign assignments reference creators but do not duplicate contract or compliance truth. Only the campaign-specific client approval flag lives on the Campaign record.

External messages, sample fulfillment and writebacks remain outside the Cockpit runtime until an authorized adapter and explicit approval path are implemented.

## Next integration increments

1. First client-approved campaign with creators that have cleared contract/compliance/eligibility gates.
2. Approved outreach adapter with idempotency protection.
3. Sample fulfillment adapter.
4. TikTok Shop / authorized performance ingestion.
5. Persistent runtime store and multi-brand isolation.
