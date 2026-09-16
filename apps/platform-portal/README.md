# GMVGANG Platform Portal

Shared web application and same-origin Node runtime for the Creator Portal, Brand Portal and internal Team Workspace.

## Production architecture

The Portal uses Supabase for technical authentication and Postgres persistence while GMVGANG domain rules remain in the workspace packages.

```text
Browser
  ↓ passwordless Supabase Auth / secure cookies
app.gmvgang.de Node runtime
  ↓ re-verified identity
@gmvgang/platform-supabase
  ↓
@gmvgang/platform-foundation + @gmvgang/creator-registration
  ↓
Supabase technical platform tables
  ↓ later approved sync
Notion / GMVGANG Company OS operational SSOT
```

The Supabase database is not a second Creator/Brand CRM. Technical records use linkage fields such as `creator_master_id` so the platform can later synchronize with the existing Company OS record.

## Authentication

- `/login` uses passwordless email magic-link/OTP initiation through Supabase Auth.
- `/auth/callback` exchanges the PKCE code or supported token hash and writes the browser session through `@supabase/ssr` cookie storage.
- `GET /api/session` reads the same-origin cookies, obtains the access token and then re-verifies that identity server-side through `@gmvgang/platform-supabase`.
- the server loads `platform_users`, `memberships` and `organizations`, then delegates the final account/tenant/role decision to `resolvePlatformSession`.
- client-supplied user IDs or roles are never authoritative.
- invalid, expired, unverified or inactive identities fail closed.

## Creator registration

`/join` remains public to discover, but registration requires an authenticated platform session.

`POST /api/creator/registration`:

- accepts only allowlisted registration fields
- derives `userId` from the verified server session
- enforces the exact current `CREATOR_PRIVACY_NOTICE_VERSION`
- delegates consent, handle-dedupe, referral attribution and profile lifecycle logic to `@gmvgang/creator-registration`
- writes technical records through `@gmvgang/platform-supabase`
- provisions an active `creator` membership in the canonical GMVGANG organization after successful registration
- never silently reactivates a revoked Creator membership
- returns only a minimized Creator registration response

The registration endpoint does not admit a Creator into the contractual GMVGANG Creator Network and does not create or approve monetary referral rewards.

## Brand Workspace contract

The protected Brand Workspace reads its first customer-facing modules from `GET /api/brand/overview`.

The browser performs an additional tenant-equality guard and refuses to render payloads when `model.organizationId` differs from the verified portal session's organization. This is defense in depth only; server-side tenant authorization remains mandatory. The production Brand Overview data source is still a later integration gate.

## Routes

- `/` — public platform overview
- `/login` — passwordless account login/signup
- `/auth/callback` — Supabase account callback
- `/join` — Creator registration surface
- `/creator` — Creator Portal; requires `creator.portal.access`
- `/brand` — Brand Portal; requires `brand.portal.access`
- `/team` — internal workspace; requires `team.workspace.read`

## Environment

Copy `apps/platform-portal/.env.example` and configure the deployment environment.

Server-only values:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CREATOR_PRIVACY_NOTICE_VERSION`

Browser-public build values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_CREATOR_PRIVACY_NOTICE_VERSION`

`SUPABASE_SERVICE_ROLE_KEY` must never be exposed in a `VITE_*` variable or committed to GitHub.

The browser and server Privacy Notice versions must match. A stale version is rejected by the server even if a browser hidden field is manipulated.

## Build and production start

```bash
pnpm --filter @gmvgang/platform-portal build
pnpm --filter @gmvgang/platform-portal start
```

The Node runtime serves the built Vite `dist` and the `/api/*` routes from the same origin. This avoids cross-origin auth/session plumbing for the portal MVP.

Local Vite-only development can still use the explicit `VITE_PLATFORM_DEV_*` preview variables, but it does not represent the full production API/auth path.

## Database migrations

Supabase migrations live under `/supabase/migrations`.

Current platform migrations define:

- platform users
- organizations and memberships
- technical Creator profiles
- immutable referral attribution
- consent evidence
- server-only platform audit events
- the canonical GMVGANG platform organization
- RLS and explicit grants

The migrations must still be applied and validated against the connected Supabase project before any live Creator registration is enabled.

## Security / SSOT

- production auth is fail-closed
- service-role credentials remain server-only
- exposed tables have RLS enabled and `anon` has no table privileges
- Creator registration writes run only through the server/domain layer
- referral identity is immutable in domain logic and Postgres
- revoked memberships are not automatically restored
- no secrets or production customer/Creator raw data belong in the repository
- Notion / GMVGANG Company OS remains the operational SSOT

## Remaining production gates

1. apply and lint the migrations in the real Supabase project
2. configure Auth Site URL and allowed redirect URL for `https://app.gmvgang.de/auth/callback`
3. configure matching server/browser environment variables
4. run a real passwordless login → session → Creator registration E2E test
5. connect the technical Creator profile to the existing Creator SSOT and persist `creator_master_id`
6. connect `/api/brand/overview` to the approved tenant-scoped production data source
