# GMVGANG Platform Supabase Adapter

Server-only adapter layer between Supabase Auth/Postgres and the existing GMVGANG platform domain packages.

## Responsibilities

- verify Supabase access tokens before deriving a GMVGANG platform session
- map persisted `platform_users`, `memberships` and `organizations` into `@gmvgang/platform-foundation`
- provide Creator registration repositories for `@gmvgang/creator-registration`
- persist technical Creator profile, referral, consent and audit records without creating a second operational CRM

## Security boundary

- `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be exposed through Vite or any `VITE_*` variable
- server authorization still runs through `resolvePlatformSession`; client-supplied roles and user IDs are never authoritative
- public tables have RLS enabled
- `anon` receives no table privileges
- authenticated browser users receive read-only access only to their own/related technical rows
- all registration writes run through the server/domain command layer
- referral identity is immutable at both domain and database level

## SSOT boundary

`creator_profiles.creator_master_id` is the technical link to the existing Creator SSOT. The portal database is not the operational Creator CRM. A separate approved sync/writeback adapter must link the technical profile to the existing Company OS Creator record.

## Supabase migration

The initial schema is in:

`supabase/migrations/20260916010000_platform_foundation.sql`

Before production rollout, run the migration in the connected Supabase project and verify it with Supabase DB lint/RLS tests. No production project credentials belong in GitHub.
