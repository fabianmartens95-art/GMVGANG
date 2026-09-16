-- PENDING / NOT YET APPLIED TO PRODUCTION.
-- Protected TikTok identity bridge for Seller Analytics attribution.
-- Raw creator open_id and raw video ids MUST NOT be stored here; only HMAC-SHA256 digests.
-- Requires the platform foundation migration because it reuses private.set_updated_at().

create table if not exists public.tiktok_creator_identity_links (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  connection_id text not null,
  shop_id text not null,
  creator_open_id_digest text not null check (creator_open_id_digest ~ '^[a-f0-9]{64}$'),
  creator_id text not null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  linked_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'active' and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  )
);

create table if not exists public.tiktok_video_identity_links (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  connection_id text not null,
  shop_id text not null,
  video_id_digest text not null check (video_id_digest ~ '^[a-f0-9]{64}$'),
  creator_identity_link_id uuid not null references public.tiktok_creator_identity_links(id) on delete restrict,
  content_id text not null,
  campaign_id text,
  product_id text,
  status text not null default 'active' check (status in ('active', 'revoked')),
  linked_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'active' and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  )
);

-- At most one active mapping per provider identity and per internal identity in the same shop/tenant.
create unique index if not exists tiktok_creator_identity_active_external_idx
  on public.tiktok_creator_identity_links (
    organization_id, connection_id, shop_id, creator_open_id_digest
  )
  where status = 'active';

create unique index if not exists tiktok_creator_identity_active_internal_idx
  on public.tiktok_creator_identity_links (
    organization_id, connection_id, shop_id, creator_id
  )
  where status = 'active';

create unique index if not exists tiktok_video_identity_active_external_idx
  on public.tiktok_video_identity_links (
    organization_id, connection_id, shop_id, video_id_digest
  )
  where status = 'active';

create unique index if not exists tiktok_video_identity_active_content_idx
  on public.tiktok_video_identity_links (organization_id, content_id)
  where status = 'active';

create index if not exists tiktok_video_identity_creator_link_idx
  on public.tiktok_video_identity_links (creator_identity_link_id)
  where status = 'active';

create or replace function private.prevent_tiktok_creator_identity_remap()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.organization_id is distinct from new.organization_id
    or old.connection_id is distinct from new.connection_id
    or old.shop_id is distinct from new.shop_id
    or old.creator_open_id_digest is distinct from new.creator_open_id_digest
    or old.creator_id is distinct from new.creator_id
    or old.linked_at is distinct from new.linked_at then
    raise exception 'TIKTOK_CREATOR_IDENTITY_IMMUTABLE';
  end if;

  if old.status = 'revoked' and new.status <> 'revoked' then
    raise exception 'TIKTOK_CREATOR_IDENTITY_REACTIVATION_FORBIDDEN';
  end if;

  return new;
end;
$$;

create or replace function private.prevent_tiktok_video_identity_remap()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.organization_id is distinct from new.organization_id
    or old.connection_id is distinct from new.connection_id
    or old.shop_id is distinct from new.shop_id
    or old.video_id_digest is distinct from new.video_id_digest
    or old.creator_identity_link_id is distinct from new.creator_identity_link_id
    or old.content_id is distinct from new.content_id
    or old.campaign_id is distinct from new.campaign_id
    or old.product_id is distinct from new.product_id
    or old.linked_at is distinct from new.linked_at then
    raise exception 'TIKTOK_VIDEO_IDENTITY_IMMUTABLE';
  end if;

  if old.status = 'revoked' and new.status <> 'revoked' then
    raise exception 'TIKTOK_VIDEO_IDENTITY_REACTIVATION_FORBIDDEN';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_tiktok_creator_identity_remap() from public, anon, authenticated;
revoke all on function private.prevent_tiktok_video_identity_remap() from public, anon, authenticated;

create or replace trigger tiktok_creator_identity_updated_at
before update on public.tiktok_creator_identity_links
for each row execute function private.set_updated_at();

create or replace trigger tiktok_creator_identity_immutable
before update on public.tiktok_creator_identity_links
for each row execute function private.prevent_tiktok_creator_identity_remap();

create or replace trigger tiktok_video_identity_updated_at
before update on public.tiktok_video_identity_links
for each row execute function private.set_updated_at();

create or replace trigger tiktok_video_identity_immutable
before update on public.tiktok_video_identity_links
for each row execute function private.prevent_tiktok_video_identity_remap();

alter table public.tiktok_creator_identity_links enable row level security;
alter table public.tiktok_video_identity_links enable row level security;

-- Protected server-only identity bridge. No browser grants or policies.
-- DELETE is intentionally excluded; revocation preserves attribution history.
revoke all on table public.tiktok_creator_identity_links from anon, authenticated, service_role;
revoke all on table public.tiktok_video_identity_links from anon, authenticated, service_role;
grant select, insert, update on table public.tiktok_creator_identity_links to service_role;
grant select, insert, update on table public.tiktok_video_identity_links to service_role;

comment on table public.tiktok_creator_identity_links is
  'Server-only TikTok creator identity bridge. Stores keyed HMAC digests of provider open_id, never raw provider identity. Internal creator reference remains immutable after linking.';

comment on table public.tiktok_video_identity_links is
  'Server-only TikTok video identity bridge. Stores keyed HMAC digests of provider video id and immutable internal content attribution. Raw provider video ids are not persisted.';
