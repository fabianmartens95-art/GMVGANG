# GMVGANG Platform Portal

Shared web shell for the future Creator Portal, Brand Portal and internal Team Workspace.

## Current boundary

This app is intentionally provider-neutral. It consumes `@gmvgang/platform-foundation` for role/capability decisions and expects production sessions from a same-origin server endpoint at `/api/session`.

Production session handling is fail-closed:

- the browser sends credentials only to same-origin platform endpoints
- responses are requested with `cache: no-store`
- unknown roles, malformed payloads and role-bearing sessions without an organization/tenant are rejected
- transport errors and non-success responses resolve to an anonymous session or an empty optional read model
- provider verification, account lookup, membership lookup and tenant authorization stay server-side

The current `EnvironmentSessionAdapter` remains only for local development previews. `VITE_PLATFORM_DEV_ROLE` and `VITE_PLATFORM_DEV_ORGANIZATION_ID` are honored only when `import.meta.env.DEV` is true. A development role also requires an explicit development organization ID so local previews exercise the same tenant assumption as production portal roles.

## Production session contract

`GET /api/session` must return one of:

```json
{ "status": "anonymous", "roles": [] }
```

or a server-resolved, tenant-bound session:

```json
{
  "status": "authenticated",
  "userId": "platform-user-id",
  "organizationId": "organization-id",
  "roles": ["brand_member"]
}
```

A multi-workspace client may send `X-GMVGANG-Organization-Id` as request context. That header is an untrusted tenant selection only. The server must verify the provider identity, load the persisted PlatformUser, Memberships and Organizations, and authorize the requested organization before returning roles or tenant data. Client-supplied roles or organization IDs must never be treated as authoritative.

The concrete authentication provider is deliberately not selected in this package. Server infrastructure should implement the provider-neutral identity and persistence ports from `@gmvgang/platform-foundation` and resolve the final session through the shared session service.

## Workspace discovery contract

Authenticated users with access to more than one organization can use the portal workspace selector. The portal discovers available workspaces from:

`GET /api/workspaces`

The endpoint must derive its response exclusively from the verified server identity and active persisted memberships. A response is an array of tenant-local access records:

```json
[
  {
    "organizationId": "gmvgang-org-id",
    "organizationType": "gmvgang",
    "name": "GMVGANG",
    "roles": ["founder", "admin"]
  },
  {
    "organizationId": "brand-org-id",
    "organizationType": "brand",
    "name": "Example Brand",
    "roles": ["brand_member"]
  }
]
```

The portal may persist the current UI selection in the `?workspace=` URL parameter so navigation can retain context. The query parameter is not authorization state. It is forwarded as request context only and must be revalidated by the server for every tenant-bound session or data read.

No roles are merged across workspaces. When the authenticated user belongs to multiple organizations and no organization is explicitly selected, the platform session remains authenticated but has no tenant roles until a valid workspace is selected.

## Brand Workspace contract

The protected Brand Workspace reads its first customer-facing modules from `GET /api/brand/overview`.

For tenant-scoped reads the portal sends the same `X-GMVGANG-Organization-Id` request context used for session resolution. The endpoint must independently authorize that organization for the verified user before reading Brand data.

The endpoint is expected to return the existing `BrandPortalReadModel` plus a source label. The browser performs an additional tenant-equality guard and refuses to render the payload when `model.organizationId` differs from the verified portal session's organization. This browser guard is defense in depth only; the server must authorize the tenant before reading or returning any Brand data.

The current Brand Workspace renders:

- Profitability KPIs: GMV, Net Revenue, Contribution and Contribution Margin
- variable cost breakdown
- explainable Next Best Actions from `@gmvgang/brand-intelligence`
- source/readiness coverage for Profitability, Creator Ops, Rights, Inventory and Paid Performance
- explicit unavailable state when the server data source is not connected

For local visual development only, set `VITE_PLATFORM_DEV_BRAND_DEMO=1` with a `brand_member` role and a development organization ID. The fixture is synthetic and is visibly labeled `SYNTHETIC DEV DATA`. Production never uses that fixture.

## Areas

- `/` — public platform overview
- `/join` — Public Creator Join flow
- `/creator` — Creator Portal shell; requires `creator.portal.access`
- `/brand` — Brand Portal shell; requires `brand.portal.access`
- `/team` — internal workspace shell; requires `team.workspace.read`

## Development

```bash
cp apps/platform-portal/.env.example apps/platform-portal/.env.local
pnpm --filter @gmvgang/platform-portal dev
```

Change `VITE_PLATFORM_DEV_ROLE` and set `VITE_PLATFORM_DEV_ORGANIZATION_ID` locally to preview permitted areas.

## Security / SSOT

- Production remains anonymous when `/api/session` is missing, invalid or unauthenticated.
- Portal route access is derived from shared capabilities, not hard-coded duplicate role rules.
- Tenant-bound roles are never accepted without an organization ID.
- Workspace discovery exposes only organizations backed by active server-side memberships.
- `?workspace=` and `X-GMVGANG-Organization-Id` are selectors, never authorization evidence.
- Brand overview payloads are not rendered across tenant boundaries.
- No API tokens, passwords, Creator PII or customer data belong in the repository.
- Notion / GMVGANG Company OS remains the operational SSOT during this phase.
- The next implementation gate is the concrete production provider + persistence adapter behind `/api/session`, `/api/workspaces` and tenant-bound read endpoints, followed by durable Creator/Brand data integration.
