# Affiliate Performance Production Activation Gate

## Status

This path is deliberately **disabled by default**. The repository contains the canonical model, Seller Analytics boundaries, persistence adapter, Brand Portal read model and the pending Supabase migration, but none of those facts authorize production activation.

As verified read-only on 2026-09-16, the current Supabase project does **not** contain `public.affiliate_performance_measurements`. No migration, RLS change, table grant, TikTok credential, production sync or server environment activation was performed as part of this implementation.

## Required order

Activation is allowed only in this order:

1. Review `supabase/pending/20260916_affiliate_performance_store.sql` against the current production schema.
2. Deliberately promote/apply the migration through the approved Supabase migration workflow.
3. Run `supabase/verify/affiliate_performance_store.sql` and require a clean result.
4. Review Supabase security advisors after the migration.
5. Decide and record the Brand-read policy thresholds. They are business/operations configuration, not implicit defaults.
6. Set all Affiliate Performance server variables together.
7. Deploy the Platform Server and verify `/health` reports `affiliatePerformanceRead: "configured"`.
8. Verify an authenticated Brand workspace with no measurements returns an explicit unavailable state rather than fabricated metrics.
9. Only after the read path is proven may a separate approved ingestion activation introduce production TikTok credentials or scheduled Seller Analytics reads.

Steps 2, 6, 7 and 9 are production actions and must not be inferred from code being merged.

## Server gate

The Platform Server keeps Brand performance reads disabled unless all of the following are true:

```text
AFFILIATE_PERFORMANCE_READ_ENABLED=1
AFFILIATE_PERFORMANCE_SCHEMA_VERIFIED=1
AFFILIATE_PERFORMANCE_LOOKBACK_DAYS=<explicit integer, 1..3650>
AFFILIATE_PERFORMANCE_MAX_RECORDS=<explicit integer, 1..1000>
AFFILIATE_PERFORMANCE_MIN_COVERAGE_RATIO=<explicit number, >0..1>
AFFILIATE_PERFORMANCE_MAX_SOURCE_AGE_MINUTES=<explicit positive number>
AFFILIATE_PERFORMANCE_REQUIRED_METRICS=<comma-separated canonical metric names>
```

Policy values while the feature flag is disabled are treated as a configuration error. This prevents a partially staged environment from looking ready.

`AFFILIATE_PERFORMANCE_SCHEMA_VERIFIED=1` is an operator attestation that the SQL verification was run successfully. It is not a substitute for the verification script.

## Database invariants

The verification script requires:

- `public.affiliate_performance_measurements` exists.
- RLS is enabled.
- `anon` and `authenticated` have no table privileges.
- `service_role` has SELECT/INSERT/UPDATE and no DELETE.
- no browser RLS policy exists on the server-only table.
- provider identity uniqueness exists.
- coverage uniqueness exists.
- the `updated_at` trigger exists.

The application must not weaken these invariants to make the Data API easier to use.

## Runtime behavior

When disabled:

- the Platform Server does not inject an Affiliate Performance read policy;
- the Brand overview returns the existing explicit unavailable state;
- `/health` reports `affiliatePerformanceRead: "disabled"`.

When deliberately configured after schema verification:

- the server composes the existing Supabase measurement driver with the tenant-bound `BrandOverviewReadPort`;
- queries remain scoped to the authenticated `organizationId`;
- provisional, stale, incomplete or potentially truncated measurement sets are marked `partial`;
- empty measurement sets remain `unavailable`;
- overlapping performance slices are not silently summed into one GMV total;
- Profitability remains independent from raw affiliate performance unless separately sourced economics are available.

## Separate ingestion gate

Read-path activation and TikTok ingestion activation are intentionally separate decisions. Enabling the Brand read path must not automatically:

- add TikTok credentials;
- start Seller Analytics API calls;
- start a scheduler or cron;
- create campaign attribution;
- expose raw TikTok creator identifiers;
- send any external communication.
