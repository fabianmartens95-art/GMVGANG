# GMVGANG Platform Portal

Shared web shell for the future Creator Portal, Brand Portal and internal Team Workspace.

## Current boundary

This app is intentionally provider-neutral. It consumes `@gmvgang/platform-foundation` for role/capability decisions and now expects production sessions from a same-origin server endpoint at `/api/session`.

Production session handling is fail-closed:

- the browser sends credentials only to the same-origin session endpoint
- responses are requested with `cache: no-store`
- unknown roles, malformed payloads and role-bearing sessions without an organization/tenant are rejected
- transport errors and non-success responses resolve to an anonymous session
- provider verification, account lookup, membership lookup and tenant selection stay server-side

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

The concrete authentication provider is deliberately not selected in this package. The server adapter must first verify the provider identity, then use the shared `resolvePlatformSession` domain function with persisted PlatformUser, Membership and Organization records. Client-supplied roles or organization IDs must never be treated as authoritative.

## Areas

- `/` — public platform overview
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
- No API tokens, passwords, Creator PII or customer data belong in the repository.
- Notion / GMVGANG Company OS remains the operational SSOT during this phase.
- The next implementation step is the concrete provider + persistence adapter behind `/api/session`, followed by authenticated Public Creator Registration, Profile Completion and immutable Referral Capture.
