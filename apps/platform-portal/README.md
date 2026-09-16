# GMVGANG Platform Portal

Shared web application for Creator, Brand and internal Team surfaces under `app.gmvgang.de`.

## Architecture

The portal is one role- and tenant-aware application. It consumes the shared Platform Foundation contracts and the host-neutral `@gmvgang/platform-api`; it does not create separate Creator, Brand or Team backends.

Production authentication is prepared around Supabase Auth plus the existing Supabase/Postgres platform persistence layer:

1. `/login` sends a passwordless e-mail login link through the browser-safe Supabase client.
2. `/auth/callback` exchanges the PKCE code/token and establishes the Supabase cookie session.
3. The Node host reads or refreshes those cookies only as session transport and extracts the access token.
4. `@gmvgang/platform-api` invokes `resolveSupabasePlatformSessionContext()`, which re-verifies the Supabase identity and resolves persisted PlatformUser, Membership and Organization data.
5. Client-supplied roles, user IDs and organization IDs are never authoritative.

The service-role key is server-only. It must never be exposed in `VITE_*` variables or browser bundles.

## API surface

The production Node host bridges incoming Node HTTP requests to the existing host-neutral Web Request/Response API layer:

- `GET /api/session`
- `GET /api/workspaces`
- `POST /api/creator/registration`

Creator Registration is same-origin protected, requires an authenticated verified account, enforces the configured privacy-notice version and derives `userId` exclusively from the verified server session.

After successful Creator Registration, the technical account receives an active `creator` membership in the canonical GMVGANG platform organization so the existing `creator.portal.access` capability becomes available. A revoked creator membership is never silently reactivated.

## Workspace and tenant boundary

Authenticated users may belong to more than one organization. The portal discovers workspaces through `GET /api/workspaces` and may carry the selected organization in `?workspace=` / `X-GMVGANG-Organization-Id`.

Those values are selectors only. Every selected organization is re-authorized against persisted active Memberships. Roles are not merged across tenants.

## Portal route hierarchy

Public:

- `/` — platform overview
- `/join` — Creator Join
- `/login` — passwordless account login; hidden from primary navigation
- `/auth/callback` — Supabase callback; hidden from primary navigation

Creator:

- `/creator` — overview
- `/creator/profile` — profile
- `/creator/referrals` — Referral Hub
- `/creator/matches` — matching
- `/creator/campaigns` — campaigns
- `/creator/performance` — performance

Brand:

- `/brand` — overview
- `/brand/profitability` — Profitability Center
- `/brand/actions` — Next Best Actions
- `/brand/campaigns` — campaigns
- `/brand/creators` — Creator Intelligence
- `/brand/approvals` — approvals
- `/brand/reporting` — reporting

Internal team:

- `/team` — overview
- `/team/creators` — Creator Operations
- `/team/brands` — Brand Operations
- `/team/campaigns` — Campaign Control
- `/team/approvals` — Approval Center
- `/team/risk` — Risk & Alerts
- `/team/activity` — Activity Trail

Every protected nested route inherits its parent area's capability and tenant boundary.

## Environment

Browser-safe build values:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_CREATOR_PRIVACY_NOTICE_VERSION=
```

Server-only runtime values:

```bash
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CREATOR_PRIVACY_NOTICE_VERSION=
```

`VITE_CREATOR_PRIVACY_NOTICE_VERSION` is only the version rendered into the form. `CREATOR_PRIVACY_NOTICE_VERSION` is authoritative on the server; mismatches fail closed.

Development-only preview variables remain available for local visual work:

```bash
VITE_PLATFORM_DEV_ROLE=creator
VITE_PLATFORM_DEV_ORGANIZATION_ID=
VITE_PLATFORM_DEV_BRAND_DEMO=0
```

## Build and run

```bash
pnpm --filter @gmvgang/platform-portal build
pnpm --filter @gmvgang/platform-portal start
```

The production server serves the Vite `dist` directory with SPA fallback and routes `/api/*` into `@gmvgang/platform-api`.

## Security boundary

- Supabase cookies are transport, not authorization evidence.
- Access tokens are re-verified by the server-side Supabase session resolver before roles or tenants are accepted.
- `X-GMVGANG-Organization-Id` and `?workspace=` are selectors only; persisted Memberships decide access.
- Creator Registration never accepts browser-supplied `userId` or roles.
- API mutation requests require same origin.
- Server secrets are fail-fast required at process startup.
- CSP, frame denial, MIME sniffing protection, referrer policy and a restrictive Permissions Policy are set by the Node host.
- API request bodies are bounded before being forwarded to the application layer.
- Unknown routes never infer access to protected portal areas.

## SSOT boundary

Supabase stores technical platform identity, memberships, profile linkage, referral attribution, consent and audit data. Notion / GMVGANG Company OS remains the operative business SSOT during this phase; this runtime does not create a second CRM.

## Remaining production gate

The code path is prepared, but it is not live until a real Supabase project is configured. Production activation still requires:

1. apply the checked-in Supabase migrations to the selected project,
2. configure the allowed auth redirect for `https://app.gmvgang.de/auth/callback`,
3. set browser-safe identifiers and server-only secrets in the hosting environment,
4. use the same current privacy-notice version in browser and server configuration,
5. run an end-to-end test: `/join?ref=...` → login → callback → Creator Registration → creator membership → `/creator`.

No live Supabase project mutation is performed merely by merging this code.
