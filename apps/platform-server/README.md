# GMVGANG Platform Server

Executable same-origin runtime for `app.gmvgang.de`.

## Responsibilities

- serve the built `apps/platform-portal` SPA
- own the web authentication transport with Supabase PKCE + cookies
- expose the host-neutral `@gmvgang/platform-api` routes
- keep Supabase service-role access on the server only
- resolve Creator/Brand/Team sessions through the shared Platform Foundation
- ingest PII-minimized Company OS snapshots for Creator Matches / Campaigns / provisional Performance

## Auth flow

1. `POST /api/auth/sign-in` accepts an email and optional safe relative `next` path.
2. Supabase sends a Magic Link using PKCE.
3. Supabase redirects to `/auth/callback?code=...` on `PLATFORM_PUBLIC_ORIGIN`.
4. The server exchanges the one-time code and stores the resulting session in secure same-site cookies.
5. `/api/session`, `/api/workspaces` and registration requests extract the cookie-backed access token.
6. The existing Supabase platform adapter independently validates the token with `getUser` / `getClaims` before any platform authorization.
7. `POST /api/auth/sign-out` revokes the local Supabase session and clears auth cookies.

`getSession()` is used only as a cookie-session extraction/refresh mechanism. It is never the authorization decision. Authorization remains server-side and revalidated.

## Creator Workspace Company OS source

The preferred production path reuses the already-sanitized Company OS snapshot pipeline instead of giving the Platform runtime a second direct Notion read credential.

```text
Notion Company OS
    |
    | existing Make pagination + sanitization boundary
    v
Make scheduled sync
    |
    +--> Campaign Cockpit
    |
    +--> app.gmvgang.de/api/internal/company-os-sync/{source}
              |
              v
        in-memory Creator Workspace source
              |
              v
        authenticated /api/creator/workspace
```

The internal sync endpoint:

- accepts only `POST` JSON requests
- requires `X-Company-OS-Sync-Secret`
- accepts only `creators`, `campaigns` and `assignments`
- caps each snapshot payload at 5 MB
- re-applies explicit property allowlists before storage
- stores no Creator email, phone, address, tax data or contract contents
- resolves a Creator only through the stable Creator master relation
- fails closed until all three snapshots have arrived

Snapshot state is intentionally runtime-local in this increment. A restart therefore returns the Creator Workspace to unavailable until the scheduled Make sync repopulates all three sources. No empty/demo workspace is presented as live data during that gap.

## Required environment

- `PLATFORM_PUBLIC_ORIGIN` — exact origin, e.g. `https://app.gmvgang.de`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — server secret
- `CREATOR_PRIVACY_NOTICE_VERSION`
- `COMPANY_OS_SYNC_SECRET` — preferred Creator Workspace machine secret; minimum 32 characters
- `PORT` — supplied by Railway in production
- `PLATFORM_PORTAL_DIST_DIR` — optional; defaults to `apps/platform-portal/dist`

For the portal build, `VITE_CREATOR_PRIVACY_NOTICE_VERSION` should match `CREATOR_PRIVACY_NOTICE_VERSION`. The API remains authoritative and rejects stale browser versions.

`NOTION_ASSIGNMENT_DATA_SOURCE_ID` + `NOTION_TOKEN` remain supported as a fallback direct Creator Workspace source, but the sanitized Company OS snapshot path is preferred in production.

## Production build/start

From the repository root:

```bash
pnpm install
pnpm --filter @gmvgang/platform-portal build
pnpm --filter @gmvgang/platform-server start
```

The server uses `tsx` intentionally for the current monorepo because internal workspace packages export TypeScript source. A later packaging pass can prebundle the runtime without changing the auth/API boundaries.

## Security

- Auth and API mutations require same-origin browser requests.
- Supabase auth cookies are forced `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- Multiple `Set-Cookie` values remain separate.
- API responses are `no-store`.
- Browser input never supplies authoritative user IDs, roles or organization membership.
- Static files are served only from the configured portal dist root.
- Normal request bodies are capped at 1 MiB; authenticated machine snapshots are capped separately at 5 MB.
- Company OS machine secrets are compared using constant-time equality.
