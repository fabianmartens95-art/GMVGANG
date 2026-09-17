# Native Creator Qualification R2

## Purpose

GMVGANG replaces the operational dependency on Tally/Make for Creator Runde 2 with an account-bound native portal flow.

## Runtime boundary

- Route: `/creator/qualification`
- API: `GET/POST /api/creator/qualification`
- Identity source: verified GMVGANG session
- Persistence: `creator_qualifications` in Supabase, server-only through the platform service role
- Browser-provided creator IDs are not accepted.

## Governance

R2 is editable only while the creator network status is `profile_complete`. After internal progression to `qualified`, `invited`, `contracted`, `active`, `performing`, `rejected`, or `paused`, the stored R2 response is a read-only snapshot.

R2 submission does not automatically qualify or advance a creator. Internal review remains authoritative.

## Reliability controls

- server-side domain validation
- database consistency constraints
- rate limiting
- idempotency protection
- platform audit events for initial submission and updates
- row level security with no direct `anon` or `authenticated` table access

## Cutover gate

Tally/Make remains available as a fallback until all of the following are green:

1. repository typecheck, tests, and build
2. production database migration applied and verified
3. authenticated portal E2E smoke test for GET/POST and account isolation
4. first pilot creator successfully completes native R2 without manual data repair

Only after this gate may the Runde-2 Tally/Make path be retired.
