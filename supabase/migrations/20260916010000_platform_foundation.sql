create schema if not exists private;

create table if not exists public.platform_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  status text not null default 'active' check (status in ('pending', 'active', 'suspended', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('gmvgang', 'brand')),
  name text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.platform_users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null check (role in ('founder', 'admin', 'creator_manager', 'brand_manager', 'closer', 'creator', 'brand_member')),
  status text not null default 'invited' check (status in ('invited', 'active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, organization_id, role)
);

create table if not exists public.creator_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.platform_users(id) on delete cascade,
  creator_master_id text,
  tiktok_handle text not null unique,
  display_name text,
  market text,
  language text,
  niche text[],
  network_status text not null default 'registered' check (
    network_status in ('registered', 'profile_complete', 'qualified', 'invited', 'contracted', 'active', 'performing', 'rejected', 'paused')
  ),
  profile_completion_percent integer not null default 0 check (profile_completion_percent between 0 and 100),
  referral_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (tiktok_handle = lower(tiktok_handle)),
  check (tiktok_handle !~ '^@')
);

create table if not exists public.referral_attributions (
  id uuid primary key default gen_random_uuid(),
  referrer_creator_profile_id uuid not null references public.creator_profiles(id) on delete restrict,
  referred_creator_profile_id uuid not null unique references public.creator_profiles(id) on delete restrict,
  referral_code text not null,
  status text not null default 'attributed' check (
    status in ('attributed', 'profile_complete', 'qualified', 'contracted', 'active', 'performing', 'rejected', 'fraud_review')
  ),
  attributed_at timestamptz not null,
  qualified_at timestamptz,
  contracted_at timestamptz,
  activated_at timestamptz,
  performing_at timestamptz,
  fraud_flags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (referrer_creator_profile_id <> referred_creator_profile_id)
);

create table if not exists public.creator_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.platform_users(id) on delete cascade,
  age_confirmed boolean not null,
  privacy_accepted boolean not null,
  privacy_notice_version text not null,
  accepted_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (age_confirmed = true),
  check (privacy_accepted = true)
);

create table if not exists public.platform_audit_events (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  user_id uuid references public.platform_users(id) on delete set null,
  creator_profile_id uuid references public.creator_profiles(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  occurred_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists memberships_user_id_idx on public.memberships(user_id);
create index if not exists memberships_organization_id_idx on public.memberships(organization_id);
create index if not exists creator_profiles_referral_code_idx on public.creator_profiles(referral_code);
create index if not exists referral_attributions_referrer_idx on public.referral_attributions(referrer_creator_profile_id);
create index if not exists creator_consents_user_id_idx on public.creator_consents(user_id);
create index if not exists platform_audit_events_user_id_idx on public.platform_audit_events(user_id);
create index if not exists platform_audit_events_creator_profile_id_idx on public.platform_audit_events(creator_profile_id);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.provision_platform_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.platform_users (id, email, status, created_at, updated_at)
  values (new.id, coalesce(new.email, ''), 'active', now(), now())
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

create or replace function private.user_org_ids()
returns setof uuid
language sql
security definer
set search_path = ''
stable
as $$
  select m.organization_id
  from public.memberships m
  where m.user_id = (select auth.uid())
    and m.status = 'active';
$$;

create or replace function private.user_creator_profile_id()
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select cp.id
  from public.creator_profiles cp
  where cp.user_id = (select auth.uid())
  limit 1;
$$;

create or replace function private.prevent_referral_identity_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.referrer_creator_profile_id <> new.referrer_creator_profile_id
    or old.referred_creator_profile_id <> new.referred_creator_profile_id
    or old.referral_code <> new.referral_code then
    raise exception 'REFERRAL_ATTRIBUTION_IMMUTABLE';
  end if;
  return new;
end;
$$;

revoke all on function private.user_org_ids() from public;
revoke all on function private.user_creator_profile_id() from public;
grant usage on schema private to authenticated;
grant execute on function private.user_org_ids() to authenticated;
grant execute on function private.user_creator_profile_id() to authenticated;

create or replace trigger platform_users_updated_at
before update on public.platform_users
for each row execute function private.set_updated_at();

create or replace trigger organizations_updated_at
before update on public.organizations
for each row execute function private.set_updated_at();

create or replace trigger memberships_updated_at
before update on public.memberships
for each row execute function private.set_updated_at();

create or replace trigger creator_profiles_updated_at
before update on public.creator_profiles
for each row execute function private.set_updated_at();

create or replace trigger referral_attributions_updated_at
before update on public.referral_attributions
for each row execute function private.set_updated_at();

create or replace trigger referral_attributions_immutable_identity
before update on public.referral_attributions
for each row execute function private.prevent_referral_identity_change();

drop trigger if exists on_auth_user_created_platform_user on auth.users;
create trigger on_auth_user_created_platform_user
after insert or update of email on auth.users
for each row execute function private.provision_platform_user();

alter table public.platform_users enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.creator_profiles enable row level security;
alter table public.referral_attributions enable row level security;
alter table public.creator_consents enable row level security;
alter table public.platform_audit_events enable row level security;

revoke all on table public.platform_users from anon, authenticated;
revoke all on table public.organizations from anon, authenticated;
revoke all on table public.memberships from anon, authenticated;
revoke all on table public.creator_profiles from anon, authenticated;
revoke all on table public.referral_attributions from anon, authenticated;
revoke all on table public.creator_consents from anon, authenticated;
revoke all on table public.platform_audit_events from anon, authenticated;

grant select on table public.platform_users to authenticated;
grant select on table public.organizations to authenticated;
grant select on table public.memberships to authenticated;
grant select on table public.creator_profiles to authenticated;
grant select on table public.referral_attributions to authenticated;
grant select on table public.creator_consents to authenticated;

create policy platform_users_select_self
on public.platform_users
for select
to authenticated
using ((select auth.uid()) = id);

create policy memberships_select_self
on public.memberships
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy organizations_select_membership
on public.organizations
for select
to authenticated
using (id in (select private.user_org_ids()));

create policy creator_profiles_select_self
on public.creator_profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy referral_attributions_select_related
on public.referral_attributions
for select
to authenticated
using (
  referrer_creator_profile_id = (select private.user_creator_profile_id())
  or referred_creator_profile_id = (select private.user_creator_profile_id())
);

create policy creator_consents_select_self
on public.creator_consents
for select
to authenticated
using ((select auth.uid()) = user_id);

comment on table public.platform_users is 'Technical platform identity shadow of Supabase auth.users; not the operational CRM.';
comment on table public.creator_profiles is 'Technical Creator Portal profile. creator_master_id links to the operational Creator SSOT when synchronized.';
comment on table public.referral_attributions is 'Immutable referral identity; lifecycle status may advance but referrer/referred/code cannot change.';
comment on table public.platform_audit_events is 'Server-only application audit trail; no anon/authenticated grants.';
