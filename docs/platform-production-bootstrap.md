# GMVGANG Platform Production Bootstrap

This runbook starts **after** the Supabase migrations have been applied and verified. It intentionally does not grant Founder/Admin rights automatically on account creation.

## 1. Verify the database

Run:

`supabase/verify/platform_foundation.sql`

The script must complete with:

`GMVGANG platform foundation verification passed`

Do not continue if RLS, grants, auth provisioning, referral immutability, or the canonical GMVGANG organization check fails.

## 2. Configure Supabase Auth URLs

Production target:

- Site URL: `https://app.gmvgang.de`
- Allowed redirect URL: `https://app.gmvgang.de/auth/callback`

Local development may additionally allow the exact local callback origin used by the developer. Do not add wildcard production origins.

## 3. Create the first account through the normal login flow

Open `/login`, request the Magic Link, and complete `/auth/callback`.

Expected result before Founder bootstrap:

- the Supabase `auth.users` account exists
- `public.platform_users` contains the same user ID via the provisioning trigger
- `/api/session` reports an authenticated account with no privileged role yet

This is intentional. Authentication must not silently create Founder/Admin authorization.

## 4. Grant the first Founder membership explicitly

Obtain the exact Supabase Auth user UUID for the intended Founder account. Then, using a trusted administrative SQL session, run the following statement after replacing `<USER_UUID>`:

```sql
insert into public.memberships (
  user_id,
  organization_id,
  role,
  status
)
select
  '<USER_UUID>'::uuid,
  o.id,
  'founder',
  'active'
from public.organizations o
where o.type = 'gmvgang'
  and o.status = 'active'
on conflict (user_id, organization_id, role)
do update set
  status = 'active',
  updated_at = now();
```

Then verify exactly one active Founder membership for that user:

```sql
select m.user_id, m.role, m.status, o.name, o.type
from public.memberships m
join public.organizations o on o.id = m.organization_id
where m.user_id = '<USER_UUID>'::uuid
  and m.role = 'founder'
  and m.status = 'active';
```

Expected row count: **1**.

## 5. Verify Creator self-registration separately

A normal authenticated account using `/join` should:

1. create or reuse one `creator_profile`,
2. record the configured privacy consent,
3. capture an immutable referral when valid,
4. ensure one active `creator` membership in the canonical GMVGANG organization.

After registration, a fresh `/api/session` request should include the `creator` role for the GMVGANG workspace, allowing `/creator` access.

Founder/Admin assignment is never part of public Creator registration.

## 6. Railway deployment gate

The platform runtime requires a dedicated service with these variables:

- `NODE_ENV=production`
- `PLATFORM_PUBLIC_ORIGIN=https://app.gmvgang.de`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CREATOR_PRIVACY_NOTICE_VERSION`
- `VITE_CREATOR_PRIVACY_NOTICE_VERSION` (same published version)

`SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be exposed via `VITE_*`.

Before connecting the custom domain, first verify on the Railway-generated domain:

- `/health` returns success
- anonymous `/api/session` is fail-closed
- login Magic Link completes successfully using an allowed temporary redirect URL
- authenticated `/api/session` resolves the correct workspace/roles
- `/api/workspaces` contains no unauthorized organization
- `/join` registration works for a non-privileged test account

Only after those checks should `app.gmvgang.de` be pointed at the service and the Supabase Site/Redirect URLs be finalized to the production domain.
