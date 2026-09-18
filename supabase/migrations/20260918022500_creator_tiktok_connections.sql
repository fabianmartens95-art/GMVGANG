create table if not exists public.creator_tiktok_connections (
  creator_profile_id uuid primary key references public.creator_profiles(id) on delete cascade,
  tiktok_open_id text not null unique check (char_length(tiktok_open_id) between 1 and 255),
  union_id text check (union_id is null or char_length(union_id) between 1 and 255),
  username text check (username is null or char_length(username) between 1 and 255),
  display_name text check (display_name is null or char_length(display_name) between 1 and 255),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 2048),
  is_verified boolean,
  granted_scopes text[] not null default '{}',
  status text not null default 'connected' check (status in ('connected', 'reauthorization_required', 'revoked', 'error')),
  access_token_ciphertext text,
  refresh_token_ciphertext text,
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
  check (cardinality(granted_scopes) <= 32)
);

create table if not exists public.creator_tiktok_metrics (
  id bigint generated always as identity primary key,
  creator_profile_id uuid not null references public.creator_profiles(id) on delete cascade,
  tiktok_open_id text not null check (char_length(tiktok_open_id) between 1 and 255),
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

create or replace trigger creator_tiktok_connections_updated_at
before update on public.creator_tiktok_connections
for each row execute function private.set_updated_at();

alter table public.creator_tiktok_connections enable row level security;
alter table public.creator_tiktok_metrics enable row level security;

revoke all on table public.creator_tiktok_connections from anon, authenticated;
revoke all on table public.creator_tiktok_metrics from anon, authenticated;

grant select, insert, update, delete on table public.creator_tiktok_connections to service_role;
grant select, insert, update, delete on table public.creator_tiktok_metrics to service_role;

comment on table public.creator_tiktok_connections is
  'Server-only TikTok OAuth connection state for Creator profiles. OAuth tokens are application-encrypted before persistence.';
comment on table public.creator_tiktok_metrics is
  'Historical TikTok profile metrics captured from the official TikTok API.';
comment on column public.creator_onboarding.follower_count_source is
  'Provenance for the onboarding follower count: manual fallback or TikTok-synced.';
