# GMVGANG Approval-Gated Outreach Adapter

## Objective

Provide a safe integration boundary between the deterministic Campaign Execution Core and future external creator messaging adapters.

The adapter does not decide who should be contacted. It can only execute an already available `send-outreach` action from an active, readiness-green campaign after a named human approval is supplied.

## Separation of responsibilities

```text
Company OS / Creator SSOT
        |
        v
Campaign Execution Core
        |
        | readiness green + send-outreach action
        v
Human Approval
        |
        v
Campaign Outbound Adapter
        |
        +--> Atomic idempotency claim
        +--> Authorized transport
        +--> Receipt reconciliation
        |
        v
Campaign Ledger = outreach sent
```

`@gmvgang/campaign-operations` remains side-effect free. External effects live in `@gmvgang/campaign-outbound`.

## Required gates

Initial outreach is rejected unless all of the following are true:

- campaign status is `active`
- campaign readiness is green
- creator readiness is green
- creator outreach status is `ready`
- the Campaign Action Queue currently contains `send-outreach`
- the action still requires approval
- approval ID, approver ID and approval timestamp are present
- template ID and template version are explicit

## Idempotency model

Initial outreach uses one logical action key per campaign + creator:

```text
gmvgang:campaign:<campaignId>:creator:<creatorId>:outreach:initial:v1
```

The approval ID is deliberately not part of the key. Issuing a second approval therefore cannot create a second initial outreach.

A fingerprint binds the logical action to campaign, brand, product, creator and template version. Reusing the same logical key with changed message configuration is treated as a conflict instead of silently sending different content.

## At-most-once safety

The production idempotency store must support an atomic `claim` operation before any transport call.

States:

- `in_flight` — claimed before provider invocation
- `sent` — provider receipt stored
- `uncertain` — provider call produced an ambiguous failure or timeout

An `uncertain` record is fail-closed. It must not be automatically retried. An operator must reconcile the provider state before the record is resolved. This prevents a timeout-after-send from becoming a duplicate creator message.

The reference package defines the persistence port but intentionally does not choose a production database yet. An in-memory store is suitable only for tests, never for live delivery.

## Privacy boundary

The dispatch request contains creator ID and operational campaign references, not raw email addresses, phone numbers or other contact PII.

A future authorized transport must resolve the destination inside its own protected integration boundary. Provider credentials and creator contact details must never be committed to GitHub or logged into the campaign audit trail.

## Reconciliation

After a verified provider receipt, the adapter calls the Campaign Execution Core to move creator outreach from `ready` to `sent` using the receipt timestamp.

If the provider has already sent the message but the campaign ledger did not update, a repeated dispatch call reads the stored receipt and reconciles the ledger without sending again.

## Current scope

Implemented now:

- approval validation
- readiness validation
- deterministic initial-outreach idempotency key
- message fingerprint conflict detection
- atomic idempotency store contract
- transport contract
- sent receipt reconciliation
- duplicate suppression
- ambiguous failure lockout
- unit tests

Not implemented yet:

- production persistent idempotency store
- Gmail / TikTok / Make transport
- approval UI or approval endpoint
- follow-up dispatch idempotency
- outbound execution from the hosted Cockpit

No external message is sent by this increment.
