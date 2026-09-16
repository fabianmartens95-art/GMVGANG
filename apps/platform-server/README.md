# GMVGANG Platform Server

Executable same-origin runtime for `app.gmvgang.de`.

## Responsibilities

- serve the built `apps/platform-portal` SPA
- own the web authentication transport with Supabase PKCE + cookies
- expose the host-neutral `@gmvgang/platform-api` routes
- keep Supabase service-role access on the server only
- resolve Creator/Brand/Team sessions through the shared Platform Foundation

## Auth flow

1. `POST /api/auth/sign-in` accepts an email and optional safe relative `next` path.
2. Supabase sends a Magic Link using PKCE.
3. Supabase redirects to `/auth/callback?code=...` on `PLATFORM_PUBLIC_ORIGIN`.
4. The server exchanges the one-time code and stores the resulting session in secure same-site cookies.
5. `/api/session`, `/api/workspaces` and registration requests extract the cookie-backed access token.
6. The existing Supabase platform adapter independently validates the token with `getUser` / `getClaims` before any platform authorization.
7. `POST /api/auth/sign-out` revokes the local Supabase session and clears auth cookies.

`getSession()` is used only as a cookie-session extraction/refresh mechanism. It is never the authorization decision. Authorization remains server-side and revalidated.

## Required environment

- `PLATFORM_PUBLIC_ORIGIN` — exact origin, e.g. `https://app.gmvgang.de`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — server secret
- `CREATOR_PRIVACY_NOTICE_VERSION`
- `PORT` — supplied by Railway in production
- `PLATFORM_PORTAL_DIST_DIR` — optional; defaults to `apps/platform-portal/dist`

For the portal build, `VITE_CREATOR_PRIVACY_NOTICE_VERSION` should match `CREATOR_PRIVACY_NOTICE_VERSION`. The API remains authoritative and rejects stale browser versions.

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
- Request bodies are capped at 1 MiB.
