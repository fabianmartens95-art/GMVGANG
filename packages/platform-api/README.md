# GMVGANG Platform API

Host-neutral HTTP application layer for the shared GMVGANG platform under `app.gmvgang.de`.

## Purpose

This package connects the existing portal HTTP contracts to verified platform services without binding GMVGANG to Vercel, Railway, Express or another hosting runtime.

It currently owns the explicit API surface:

- `GET /api/session`
- `GET /api/workspaces`
- `POST /api/creator/registration`

The router uses the standard Web `Request` / `Response` API so a deployment adapter only needs to translate the chosen host runtime into that contract.

## Authentication boundary

The HTTP layer does not parse or trust browser user IDs, roles or tenant IDs.

A deployment-specific `PlatformAccessTokenPort` must extract the authenticated Supabase access token from the server-side session transport. That transport is intentionally separate because the final cookie/session integration depends on the hosting/runtime setup.

Rules:

- never accept `userId` or roles from request JSON
- never expose the Supabase service-role key to the browser
- `X-GMVGANG-Organization-Id` is an untrusted workspace selector only
- every selected organization is re-authorized through persisted Memberships
- unexpected adapter errors are mapped to generic HTTP errors without leaking internal details

A missing access token returns an anonymous session / empty workspace list. Creator registration requires an authenticated verified session.

## Mutation protection

`POST /api/creator/registration` is fail-closed:

- only `application/json` is accepted
- `Origin` must match the API request origin
- when `Sec-Fetch-Site` is present it must be `same-origin`
- the configured server privacy-notice version must be non-empty
- the submitted privacy-notice version must equal the configured server version
- the trusted Creator `userId` is derived from the verified session only

The HTTP response exposes only the Creator fields required by the portal and never returns the technical platform user ID.

## Supabase wiring

`createSupabasePlatformApiServices()` wires the host-neutral service ports to:

- `resolveSupabasePlatformSessionContext()`
- `createSupabaseCreatorRegistrationPorts()`
- `registerCreator()`

The Supabase resolver now derives the authenticated session and accessible workspaces from the same verified identity + persisted Membership/Organization state.

## Remaining deployment adapter

This package intentionally does not choose a hosting provider or cookie implementation. The final deployment layer still needs to:

1. establish the Supabase browser/server authentication flow,
2. expose a server-side access-token extractor implementing `PlatformAccessTokenPort`,
3. instantiate the Supabase admin services with server-only environment variables,
4. route the selected hosting runtime to `createPlatformApiHandler()`.

This separation keeps authentication transport replaceable without changing GMVGANG domain authorization or portal contracts.
