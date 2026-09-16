# TikTok Attribution Store

## Purpose

Resolve TikTok Seller Analytics creator/video identifiers to stable internal GMVGANG Creator/Content references without placing raw provider identities into canonical performance measurements.

This is a technical identity bridge, not a Creator CRM. Notion / Company OS remains the operational SSOT for Creator and campaign business state.

## Privacy boundary

Raw TikTok `creator.open_id` and provider video IDs are accepted only transiently at the server-side attribution boundary. Before persistence or lookup they are transformed with HMAC-SHA256 using a dedicated attribution hash key and domain separation:

- creator identity namespace: `creator_open_id`
- video identity namespace: `video_id`

The dedicated key must be at least 32 bytes and must remain in the server secret store. It is not a TikTok app secret, OAuth token or browser configuration value.

The database stores only 64-character HMAC digests. It has no raw `open_id`, video ID, username or nickname columns.

## Mapping model

Two protected server-only mappings are used:

1. `tiktok_creator_identity_links`
   - organization / connection / shop scope
   - creator `open_id` HMAC digest
   - stable internal Creator ID
   - active/revoked lifecycle
2. `tiktok_video_identity_links`
   - organization / connection / shop scope
   - provider video-ID HMAC digest
   - immutable creator-identity link
   - stable internal Content ID
   - optional deterministic Campaign/Product references
   - active/revoked lifecycle

An active provider identity can have only one active internal mapping. An active internal Content ID can have only one active external video mapping within the organization.

## Fail-closed rules

- creator mappings must exist before a video can be registered.
- retrying the exact same mapping is idempotent.
- attempting to remap an existing external creator to another internal Creator ID is a conflict.
- attempting to remap an existing external video to another Content ID is a conflict.
- attempting to reuse the same internal Content ID for another active external video is a conflict.
- resolver lookups are always scoped by organization, connection and shop.
- video resolution additionally verifies that the resolved video points to the resolved creator identity link.
- revoked mappings are not resolved.
- immutable mapping fields cannot be edited in place; revocation preserves history and reactivation of the same row is forbidden.

## Database security

The pending schema is `supabase/pending/20260916_tiktok_attribution_store.sql`.

It is intentionally **not applied to production yet**.

Both tables:

- have RLS enabled.
- grant no table access to `anon` or `authenticated`.
- grant `service_role` only `SELECT`, `INSERT`, `UPDATE`.
- do not grant `DELETE` so attribution history is retained.
- use triggers to prevent identity/internal-reference remapping.

`supabase/verify/tiktok_attribution_store.sql` verifies table existence, RLS, browser denial, service-role least privilege, required unique indexes, immutability triggers and absence of raw TikTok identity columns.

## Runtime integration

`@gmvgang/affiliate-performance-supabase` exposes:

- `createHmacTikTokAttributionHasher`
- `createTikTokAttributionRegistry`
- `createTikTokVideoAttributionResolver`
- `createSupabaseTikTokAttributionDriver`

The resolver implements the `TikTokVideoAttributionResolver` port consumed by the v202605 Video Performance adapter. Successful resolution returns only stable internal `creatorId`, `contentId` and optional deterministic `campaignId` / `productId` references.

## Activation gates

Before production activation:

1. Review and intentionally promote the pending schema to a real Supabase migration.
2. Apply it to the production Supabase project.
3. Run `supabase/verify/tiktok_attribution_store.sql` and Supabase security/performance advisors.
4. Configure a dedicated server-only attribution HMAC key.
5. Define the controlled provisioning source that links existing Company-OS Creator/Content identities to provider identities.
6. Only then connect the resolver to an authorized live Seller Analytics sync.

No live TikTok credentials, live API requests or production database changes are performed by the code-only implementation.
