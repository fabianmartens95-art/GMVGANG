# GMVGANG Platform Foundation

## Purpose

The platform foundation creates the shared domain contract for the future Creator Portal, Brand Portal and internal team workspace without creating a parallel operational SSOT.

The target deployment is one shared platform application under `app.gmvgang.de`. Creator, Brand and internal team experiences are role- and tenant-scoped views of that application, not separate products or duplicate data stores. The public marketing website remains independently deployable under `gmvgang.de`.

## Domain boundaries

- `PlatformUser`: authentication identity only.
- `Organization`: GMVGANG or a brand tenant.
- `Membership`: role assignment inside an organization.
- `PlatformWorkspaceAccess`: server-derived view of one organization the authenticated user may enter, including only tenant-local roles.
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

Capabilities are explicit and deny-by-default. Creator and brand roles receive self/tenant-scoped capabilities only; internal read-all/manage capabilities are separate. Founder and Admin may enter the shared customer portal surfaces for administration, while all data reads remain tenant-bound.

## Sessions and workspace context

Provider identity, platform account state, Memberships and Organizations are resolved server-side before a session receives roles.

A user may belong to multiple Organizations. Roles are never merged across those Organizations. If multiple workspaces are available and no valid Organization is selected, the user may remain authenticated but receives no tenant roles until a workspace is selected.

The browser may carry a `?workspace=` UI selection and send `X-GMVGANG-Organization-Id` as request context. Neither value is authority. Every server endpoint must verify that the authenticated user has an active Membership in the requested active Organization before returning roles or tenant data.

`loadPlatformSessionContext()` provides the provider-neutral orchestration contract for loading the authenticated tenant session together with the list of accessible workspaces from the same persisted Membership/Organization state.

## Portal route hierarchy

Protected features live under nested routes in the shared application:

- Creator modules under `/creator/*`
- Brand modules under `/brand/*`
- internal operations modules under `/team/*`

Every explicit nested route inherits the capability boundary of its parent area. A path prefix alone never grants access. Unknown paths are not dynamically promoted into protected areas.

This keeps module growth inside one platform shell while allowing stable URLs, deep links and independent module delivery.

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

## Production infrastructure gate

The domain and browser boundaries are provider-neutral. Production still requires an explicit Founder Decision for the authentication and transactional persistence stack before `/api/session`, `/api/workspaces` and tenant-bound read/write endpoints can become live.

The selected stack must preserve these invariants:

- verified server-side identity
- persisted PlatformUser / Organization / Membership relationships
- tenant isolation at the server and database layers
- multiple Organizations per user without cross-tenant role merging
- EU-appropriate data residency and security controls
- no browser-authoritative roles or tenant IDs
- migration/reconciliation path from the operational Company OS

## SSOT rule

Notion / GMVGANG Company OS remains the operational source of truth during this phase. Portal records may carry `creatorMasterId` / `brandMasterId` links. A future migration to a transactional platform database requires an explicit architecture decision and reconciliation plan.
