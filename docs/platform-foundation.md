# GMVGANG Platform Foundation

## Purpose

The platform foundation creates the shared domain contract for the future Creator Portal, Brand Portal and internal team workspace without creating a parallel operational SSOT.

## Domain boundaries

- `PlatformUser`: authentication identity only.
- `Organization`: GMVGANG or a brand tenant.
- `Membership`: role assignment inside an organization.
- `CreatorProfile`: portal-facing creator identity linked optionally to the existing Company OS creator master record.
- `BrandProfile`: portal-facing brand identity linked optionally to the existing Company OS brand master record.
- `ExternalConnection`: metadata for TikTok Shop Seller/Creator authorization. Raw tokens are represented only by secret references.
- `ReferralAttribution`: immutable creator-to-creator attribution.
- `ReferralReward`: idempotent reward event record. Payout policy remains a separate Founder Decision.

## Roles

- Founder
- Admin
- Creator Manager
- Brand Manager
- Closer
- Creator
- Brand Member

Capabilities are explicit and deny-by-default. Creator and brand roles receive self/tenant-scoped capabilities only; internal read-all/manage capabilities are separate.

## Creator lifecycle

`registered -> profile_complete -> qualified -> invited -> contracted -> active -> performing`

`rejected` and `paused` are explicit side states. A portal account is intentionally separate from contractual GMVGANG network membership.

## Referral lifecycle

`attributed -> profile_complete -> qualified -> contracted -> active -> performing`

Referral attribution cannot be overwritten after creation. Self-referral is rejected. Fraud signals are recorded separately so that a future reward engine can put suspicious referrals into manual review rather than paying automatically.

## TikTok connections

Two providers are modeled separately:

- `tiktok_shop_seller`: owned by a Brand organization.
- `tiktok_shop_creator`: owned by a Creator profile.

Access/refresh tokens must never be returned to browsers or committed to GitHub. The domain model stores secret references only. Availability of Creator/Affiliate APIs remains market- and TikTok-approval-dependent and should be controlled by feature flags at the application layer.

## SSOT rule

Notion / GMVGANG Company OS remains the operational source of truth during this phase. Portal records may carry `creatorMasterId` / `brandMasterId` links. A future migration to a transactional platform database requires an explicit architecture decision and reconciliation plan.
