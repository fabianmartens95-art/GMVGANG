create table if not exists public.integration_secret_store (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('tiktok_creator_access_token', 'tiktok_creator_refresh_token')),
  ciphertext text not null check (char_length(ciphertext) between 32 and 16384),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_tiktok_connections (
  id uuid primary key default gen_random_uuid(),
  creator_profile_id uuid not null unique references public.creator_profiles(id) on delete cascade,
  provider text not null default 'tiktok_creator' check (provider = 'tiktok_creator'),
  external_account_digest text not null unique check (external_account_digest ~ '^[a-f0-9]{64}$'),
  union_id_digest text check (union_id_digest is null or union_id_digest ~ '^[a-f0-9]{64}$'),
  username text check (username is null or char_length(username) between 1 and 255),
  display_name text check (display_name is null or char_length(display_name) between 1 and 255),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 2048),
  is_verified boolean,
  granted_scopes text[] not null default '{}',
  status text not null default 'connected' check (status in ('connected', 'reauthorization_required', 'revoked', 'error')),
  access_token_secret_ref uuid references public.integration_secret_store(id) on delete set null,
  refresh_token_secret_ref uuid references public.integration_secret_store(id) on delete set null,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  follower_count bigint check (follower_count is null or follower_count >= 0),
  following_count bigint check (following_count is null or following_count >= 0),
  likes_count bigint check (likes_count is null or likes_count >= 0),
  video_count bigint check (video_count is null or video_count >= 0),
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(granted_scopes) <= 32),
  check (
    (status = 'connected' and access_token_secret_ref is not null and refresh_token_secret_ref is not null)
    or status <> 'connected'
  )
);

create table if not exists public.creator_tiktok_metrics (
  id bigint generated always as identity primary key,
  creator_profile_id uuid not null references public.creator_profiles(id) on delete cascade,
  follower_count bigint check (follower_count is null or follower_count >= 0),
  following_count bigint check (following_count is null or following_count >= 0),
  likes_count bigint check (likes_count is null or likes_count >= 0),
  video_count bigint check (video_count is null or video_count >= 0),
  source text not null default 'tiktok' check (source = 'tiktok'),
  captured_at timestamptz not null default now()
);

alter table public.creator_onboarding
  add column if not exists follower_count_source text not null default 'manual'
    check (follower_count_source in ('manual', 'tiktok')),
  add column if not exists follower_count_verified_at timestamptz;

create index if not exists creator_tiktok_connections_status_idx
  on public.creator_tiktok_connections(status);
create index if not exists creator_tiktok_connections_username_idx
  on public.creator_tiktok_connections(username);
create index if not exists creator_tiktok_metrics_creator_time_idx
  on public.creator_tiktok_metrics(creator_profile_id, captured_at desc);

create or replace trigger integration_secret_store_updated_at
before update on public.integration_secret_store
for each row execute function private.set_updated_at();

create or replace trigger creator_tiktok_connections_updated_at
before update on public.creator_tiktok_connections
for each row execute function private.set_updated_at();

alter table public.integration_secret_store enable row level security;
alter table public.creator_tiktok_connections enable row level security;
alter table public.creator_tiktok_metrics enable row level security;

revoke all on table public.integration_secret_store from anon, authenticated, service_role;
revoke all on table public.creator_tiktok_connections from anon, authenticated, service_role;
revoke all on table public.creator_tiktok_metrics from anon, authenticated, service_role;

grant select, insert, update, delete on table public.integration_secret_store to service_role;
grant select, insert, update, delete on table public.creator_tiktok_connections to service_role;
grant select, insert on table public.creator_tiktok_metrics to service_role;

comment on table public.integration_secret_store is
  'Server-only encrypted integration secret store. Public integration records retain opaque secret references, never token ciphertext.';
comment on table public.creator_tiktok_connections is
  'Server-only TikTok Login Kit connection state for Creator profiles. Provider account identifiers are HMAC digests and OAuth tokens are referenced through integration_secret_store.';
comment on table public.creator_tiktok_metrics is
  'Historical TikTok profile metrics captured from the official TikTok API without provider identity columns.';
comment on column public.creator_onboarding.follower_count_source is
  'Provenance for the onboarding follower count: manual fallback or TikTok-synced.';
