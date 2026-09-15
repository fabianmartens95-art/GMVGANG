# Affiliate Performance Ingestion

## Purpose

Provide a provider-neutral, audit-friendly performance layer for GMVGANG without turning GitHub or an application into a second Creator/Brand CRM.

Notion remains the operational SSOT for business state and references. High-volume performance measurements may later use a dedicated technical/analytical store, but must retain stable references back to the Company OS and platform identities.

## Current platform decision (2026-09-16)

For the Germany/EU path, start with TikTok Shop **Seller Analytics**, not the Affiliate API family.

Current official TikTok Shop documentation states that:

- Affiliate APIs are currently unavailable in UK and EU markets.
- Seller Analytics APIs version 202509 and later are available in all markets, local and cross-border.
- The 202605 Product Performance API exposes channel-level performance including affiliate total, affiliate video and affiliate LIVE performance.
- The 202605 Video Performance API adds creator attribution and can filter to affiliate accounts.
- The 202605 Product/Video performance APIs use seller authorization, are T-1, paginate with page tokens, and support up to 100 rows per page.

Relevant official endpoints:

- `GET /analytics/202605/shop_products/performance`
- `GET /analytics/202605/shop_videos/performance`

This repository currently contains **no live TikTok credentials, request signing, OAuth token exchange or production API transport** for these endpoints.

## Canonical model

`@gmvgang/affiliate-performance` defines normalized performance records with:

- provider + immutable external record identity
- explicit grain (`shop`, `campaign`, `creator`, `product`, `content`)
- explicit channel (`affiliate-total`, `affiliate-video`, `affiliate-live`, etc.)
- stable Company OS / platform references
- inclusive start date + exclusive end date + source timezone
- explicit currency
- additive raw metrics only
- observation timestamp and final/provisional state

Non-additive ratios are derived from raw totals rather than summed from provider percentages.

## Fail-closed rules

1. Negative or non-finite metrics are rejected.
2. A grain must have its corresponding identity (`productId` for product grain, etc.).
3. A reused provider record ID with different content is rejected as a conflict.
4. Two different records claiming the exact same provider/grain/channel/dimensional/time coverage are rejected to prevent double counting.
5. Aggregation rejects mixed providers, grains, channels, currencies or time windows.
6. A metric is only emitted as a total when every record in the aggregate contains that metric. Otherwise it is `null` and the completeness ratio exposes the missing coverage.
7. Currency conversion is not implicit.
8. Commission is never inferred from GMV unless a separately approved business rule/source explicitly supplies it.
9. Seller Analytics rows are not attributed to a GMVGANG campaign until a deterministic product/creator/content mapping exists.

## Initial ingestion sequence

1. Canonical performance contract + validation + aggregation. **Implemented in this increment.**
2. Add a fixture/CSV adapter for controlled end-to-end validation without TikTok credentials.
3. Reuse the platform Seller Connection contract for an authorized seller OAuth adapter; keep tokens/signing secrets outside GitHub and UI payloads.
4. Implement page-token fetching for the 202605 Product and Video Analytics endpoints.
5. Map provider creator/product/content identifiers to protected internal references.
6. Persist normalized measurements with provenance and idempotent upsert semantics.
7. Project approved campaign-level metrics into Campaign Cockpit / Brand Portal.
8. Add the first dashboard: GMV, orders, units, refund indicators, impressions, clicks, CTR, click-to-order rate, AOV, video views and GPM where source coverage is complete.

## Provider boundary

The core package only emits a secret-free request plan. A future TikTok adapter owns:

- seller OAuth token retrieval
- request signing
- shop cipher resolution
- page-token traversal
- rate-limit/backoff handling
- source-response validation
- conversion into canonical records

That adapter must never return raw access tokens or request signatures into the canonical performance domain.

## Official references verified 2026-09-16

- TikTok Shop Partner Center: Affiliate Creator API overview
- TikTok Shop Partner Center: Important New Analytics API Supports Data Drill Down & Deprecation of Old Versions (2026-01-25)
- TikTok Shop Partner Center: Analytics API Response Data Optimization (2026-05-21)
