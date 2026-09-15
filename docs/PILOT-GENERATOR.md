# Pilot Generator

Status: implemented as a deterministic Phase 1 Revenue Core component.

The Pilot Generator turns approved qualification/economics inputs plus caller-defined operating targets into one structured pilot-readiness result. It does not create a CRM, store customer data or invent agency-wide commercial thresholds.

## Inputs

- brand qualification summary: score, status and hard-gate state
- selected economics scenario summary
- caller-provided target orders, creator count and duration
- caller-provided paid-media budget and optional economic guardrails
- optional operational checks with `block` or `review` severity

## Outputs

- readiness: `ready`, `review` or `blocked`
- selected scenario reference
- target orders, creator count and duration
- forecast net revenue
- forecast paid-media spend
- forecast contribution after marketing
- projected ROAS when paid media is present
- budget guardrail result
- explicit reasons for any review/block state

## Decision rules

1. A rejected qualification or failed qualification hard gate blocks the pilot.
2. A qualification status of `review` produces review unless a blocking reason also exists.
3. A non-viable selected economics scenario blocks the pilot.
4. Exceeding caller-provided budget, contribution-margin or ROAS guardrails blocks the pilot.
5. Failed operational checks use their caller-provided severity.
6. If no block/review reason exists, readiness is `ready`.

## Boundaries

- Creator counts, duration, budgets and economic guardrails are caller-provided.
- No default stop-loss, success KPI or commercial promise is hardcoded.
- Zero paid-media spend leaves projected ROAS undefined rather than inventing a value.
- The core package is independent from Notion, Make, UI layers and external APIs.
- Future adapters may read approved inputs from the existing Notion SSOT without persisting a second copy.
