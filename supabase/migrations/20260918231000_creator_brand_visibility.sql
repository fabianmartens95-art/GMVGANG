begin;

create table if not exists public.creator_brand_visibility (
  creator_profile_id uuid primary key
    references public.creator_profiles(id) on delete restrict,
  visibility text not null default 'hidden'
    check (visibility in ('hidden', 'eligible', 'discoverable')),
  creator_opt_in_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.platform_users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint creator_brand_visibility_approval_state check (
    (
      visibility = 'discoverable'
      and creator_opt_in_at is not null
      and approved_at is not null
      and approved_by is not null
    )
    or (
      visibility <> 'discoverable'
      and approved_at is null
      and approved_by is null
    )
  )
);

comment on table public.creator_brand_visibility is
  'Server-authoritative allowlist controlling whether a Creator may appear in Brand discovery. Discoverability requires Creator opt-in plus staff approval; no Creator is discoverable by default.';

alter table public.creator_brand_visibility enable row level security;

revoke all on table public.creator_brand_visibility from anon, authenticated;
grant select, insert, update, delete on table public.creator_brand_visibility to service_role;

create index if not exists creator_brand_visibility_state_idx
  on public.creator_brand_visibility (visibility)
  where visibility = 'discoverable';

create table if not exists public.creator_brand_visibility_events (
  id uuid primary key default gen_random_uuid(),
  creator_profile_id uuid not null
    references public.creator_profiles(id) on delete restrict,
  event_type text not null
    check (event_type in (
      'creator_opt_in',
      'creator_opt_out',
      'staff_marked_eligible',
      'staff_approved_discoverable',
      'staff_hidden'
    )),
  from_visibility text
    check (from_visibility is null or from_visibility in ('hidden', 'eligible', 'discoverable')),
  to_visibility text
    check (to_visibility is null or to_visibility in ('hidden', 'eligible', 'discoverable')),
  actor_user_id uuid not null
    references public.platform_users(id) on delete restrict,
  request_id text,
  occurred_at timestamptz not null default now()
);

comment on table public.creator_brand_visibility_events is
  'Append-only audit trail for Creator Brand discoverability consent and staff visibility decisions.';

alter table public.creator_brand_visibility_events enable row level security;

revoke all on table public.creator_brand_visibility_events from anon, authenticated;
grant select, insert on table public.creator_brand_visibility_events to service_role;
revoke update, delete on table public.creator_brand_visibility_events from service_role;

create index if not exists creator_brand_visibility_events_creator_idx
  on public.creator_brand_visibility_events (creator_profile_id, occurred_at desc);

commit;
