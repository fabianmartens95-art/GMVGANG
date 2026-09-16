# GMVGANG Platform Supabase Adapter

Server-only adapter layer between Supabase Auth/Postgres and the existing GMVGANG platform domain packages.

## Responsibilities

- verify Supabase access tokens before deriving a GMVGANG platform session
- map persisted `platform_users`, `memberships` and `organizations` into `@gmvgang/platform-foundation`
- provide Creator registration repositories for `@gmvgang/creator-registration`
- persist technical Creator profile, referral, consent and audit records without creating a second operational CRM
- maintain exactly one canonical internal `gmvgang` organization
- ensure a successful public Creator registration has one active `creator` membership in that canonical organization

## Security boundary

- `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be exposed through Vite or any `VITE_*` variable
- server authorization still runs through `resolvePlatformSession`; client-supplied roles and user IDs are never authoritative
- public tables have RLS enabled
- `anon` receives no table privileges
- authenticated browser users receive read-only access only to their own/related technical rows
- all registration writes run through the server/domain command layer
- referral identity is immutable at both domain and database level
- authentication does not auto-grant Founder/Admin authorization

## Creator access provisioning

The initial account login provisions `platform_users` only. Public Creator registration then creates/reuses the technical Creator profile and calls `ensureSupabaseCreatorMembership()`.

That function:

1. resolves exactly one active internal `gmvgang` organization,
2. finds the tenant-local `creator` membership for the verified user,
3. leaves an existing active membership unchanged,
4. reactivates an invited/revoked membership, or
5. creates a new active `creator` membership.

It fails closed when the canonical GMVGANG organization is missing or ambiguous. No Brand membership is inferred or copied.

## SSOT boundary

`creator_profiles.creator_master_id` is the technical link to the existing Creator SSOT. The portal database is not the operational Creator CRM. A separate approved sync/writeback adapter must link the technical profile to the existing Company OS Creator record.

## Supabase migrations and verification

Schema and access bootstrap:

- `supabase/migrations/20260916010000_platform_foundation.sql`
- `supabase/migrations/20260916020000_platform_access_bootstrap.sql`

After applying migrations, run:

`supabase/verify/platform_foundation.sql`

The verification fails when core tables are missing, RLS is disabled, anonymous/browser write privileges are exposed, required triggers are missing, the audit trail is browser-readable, or the canonical GMVGANG organization invariant is broken.

The first Founder membership is intentionally a separate high-trust bootstrap step documented in `docs/platform-production-bootstrap.md`.

No production project credentials belong in GitHub.
