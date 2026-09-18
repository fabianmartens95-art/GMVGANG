begin;

create table if not exists public.external_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null
    check (provider in ('tiktok_shop_seller', 'tiktok_shop_creator')),
  creator_profile_id uuid
    references public.creator_profiles(id) on delete cascade,
  organization_id uuid
    references public.organizations(id) on delete cascade,
  status text not null default 'not_connected'
    check (status in ('not_connected', 'pending', 'connected', 'expired', 'revoked', 'error')),
  market text,
  external_account_id text,
  external_shop_ids text[] not null default '{}',
  granted_scopes text[] not null default '{}',
  access_token_secret_ref text,
  refresh_token_secret_ref text,
  token_expires_at timestamptz,
  last_sync_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_connections_owner_valid check (
    (
      provider = 'tiktok_shop_creator'
      and creator_profile_id is not null
      and organization_id is null
    )
    or (
      provider = 'tiktok_shop_seller'
      and organization_id is not null
      and creator_profile_id is null
    )
  ),
  constraint external_connections_connected_secret_ref check (
    status <> 'connected'
    or access_token_secret_ref is not null
  ),
  constraint external_connections_inactive_secret_ref check (
    status not in ('not_connected', 'pending', 'revoked')
    or (
      access_token_secret_ref is null
      and refresh_token_secret_ref is null
    )
  ),
  check (market is null or market ~ '^[A-Z]{2}$'),
  check (external_account_id is null or char_length(external_account_id) between 1 and 255),
  check (cardinality(external_shop_ids) <= 100),
  check (cardinality(granted_scopes) <= 100),
  check (access_token_secret_ref is null or char_length(access_token_secret_ref) between 1 and 1024),
  check (refresh_token_secret_ref is null or char_length(refresh_token_secret_ref) between 1 and 1024),
  check (last_error_code is null or char_length(last_error_code) between 1 and 128)
);

comment on table public.external_connections is
  'Server-only external account connection metadata. Lifecycle rows are retained instead of deleted so audit history remains intact. Stores secret references only, never raw OAuth access/refresh token values.';

create or replace trigger external_connections_updated_at
before update on public.external_connections
for each row execute function private.set_updated_at();

alter table public.external_connections enable row level security;

revoke all on table public.external_connections from anon, authenticated;
grant select, insert, update on table public.external_connections to service_role;
revoke delete on table public.external_connections from service_role;

create unique index if not exists external_connections_creator_provider_uidx
  on public.external_connections (creator_profile_id, provider)
  where creator_profile_id is not null;

create unique index if not exists external_connections_org_provider_uidx
  on public.external_connections (organization_id, provider)
  where organization_id is not null;

create index if not exists external_connections_status_idx
  on public.external_connections (status);

create table if not exists public.external_connection_events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null
    references public.external_connections(id) on delete restrict,
  event_type text not null
    check (event_type in (
      'connection_started',
      'connected',
      'refreshed',
      'expired',
      'revoked',
      'error',
      'disconnected'
    )),
  actor_user_id uuid
    references public.platform_users(id) on delete set null,
  request_id text,
  error_code text,
  occurred_at timestamptz not null default now(),
  check (error_code is null or char_length(error_code) between 1 and 128)
);

comment on table public.external_connection_events is
  'Append-only audit trail for external connection lifecycle events; never contains OAuth token material.';

alter table public.external_connection_events enable row level security;

revoke all on table public.external_connection_events from anon, authenticated;
grant select, insert on table public.external_connection_events to service_role;
revoke update, delete on table public.external_connection_events from service_role;

create index if not exists external_connection_events_connection_idx
  on public.external_connection_events (connection_id, occurred_at desc);

commit;
