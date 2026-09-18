begin;

create table if not exists public.creator_verifications (
  creator_profile_id uuid primary key
    references public.creator_profiles(id) on delete restrict,
  status text not null default 'unverified'
    check (status in ('unverified', 'pending_review', 'verified', 'rejected')),
  requested_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references public.platform_users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint creator_verifications_state_valid check (
    (
      status = 'unverified'
      and requested_at is null
      and decided_at is null
      and decided_by is null
    )
    or (
      status = 'pending_review'
      and requested_at is not null
      and decided_at is null
      and decided_by is null
    )
    or (
      status in ('verified', 'rejected')
      and requested_at is not null
      and decided_at is not null
      and decided_by is not null
      and decided_at >= requested_at
    )
  )
);

comment on table public.creator_verifications is
  'Server-only Creator verification state. Contains no identity documents, KYC evidence, or internal review notes.';

create or replace trigger creator_verifications_updated_at
before update on public.creator_verifications
for each row execute function private.set_updated_at();

alter table public.creator_verifications enable row level security;

revoke all on table public.creator_verifications from anon, authenticated;
grant select, insert, update on table public.creator_verifications to service_role;
revoke delete on table public.creator_verifications from service_role;

create index if not exists creator_verifications_pending_idx
  on public.creator_verifications (requested_at asc)
  where status = 'pending_review';

create table if not exists public.creator_verification_events (
  id uuid primary key default gen_random_uuid(),
  creator_profile_id uuid not null
    references public.creator_profiles(id) on delete restrict,
  event_type text not null
    check (event_type in (
      'review_requested',
      'verified',
      'rejected',
      'review_reset'
    )),
  from_status text
    check (from_status is null or from_status in ('unverified', 'pending_review', 'verified', 'rejected')),
  to_status text not null
    check (to_status in ('unverified', 'pending_review', 'verified', 'rejected')),
  actor_user_id uuid not null
    references public.platform_users(id) on delete restrict,
  request_id text,
  occurred_at timestamptz not null default now()
);

comment on table public.creator_verification_events is
  'Append-only audit trail for Creator verification requests and staff decisions.';

alter table public.creator_verification_events enable row level security;

revoke all on table public.creator_verification_events from anon, authenticated;
grant select, insert on table public.creator_verification_events to service_role;
revoke update, delete on table public.creator_verification_events from service_role;

create index if not exists creator_verification_events_creator_idx
  on public.creator_verification_events (creator_profile_id, occurred_at desc);

commit;
