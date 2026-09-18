begin;

create table if not exists public.brand_entitlements (
  organization_id uuid primary key
    references public.organizations(id) on delete cascade,
  source text not null default 'none'
    check (source in ('none', 'trial', 'paid')),
  plan text
    check (plan is null or plan in ('brand_core', 'brand_growth', 'managed_growth', 'enterprise')),
  onboarding_completed_at timestamptz,
  trial_consumed_at timestamptz,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  paid_started_at timestamptz,
  paid_ends_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint brand_entitlements_state_valid check (
    (
      source = 'none'
      and plan is null
      and onboarding_completed_at is null
      and trial_started_at is null
      and trial_ends_at is null
      and paid_started_at is null
      and paid_ends_at is null
    )
    or (
      source = 'trial'
      and plan is null
      and onboarding_completed_at is not null
      and trial_consumed_at is not null
      and trial_started_at is not null
      and trial_ends_at is not null
      and trial_consumed_at = trial_started_at
      and trial_started_at >= onboarding_completed_at
      and trial_ends_at > trial_started_at
      and paid_started_at is null
      and paid_ends_at is null
    )
    or (
      source = 'paid'
      and plan is not null
      and trial_consumed_at is not null
      and paid_started_at is not null
      and (paid_ends_at is null or paid_ends_at > paid_started_at)
      and trial_started_at is null
      and trial_ends_at is null
    )
  )
);

comment on table public.brand_entitlements is
  'Canonical server-only Brand workspace entitlement state. trial_consumed_at is retained across later paid/none states to prevent Trial replay. Access mode is derived in application code; prices and payment credentials are not stored here.';

create or replace trigger brand_entitlements_updated_at
before update on public.brand_entitlements
for each row execute function private.set_updated_at();

alter table public.brand_entitlements enable row level security;

revoke all on table public.brand_entitlements from anon, authenticated;
grant select, insert, update on table public.brand_entitlements to service_role;
revoke delete on table public.brand_entitlements from service_role;

create table if not exists public.brand_entitlement_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  event_type text not null
    check (event_type in (
      'trial_started',
      'trial_expired_observed',
      'paid_plan_activated',
      'paid_plan_changed',
      'paid_plan_ended',
      'entitlement_reconciled'
    )),
  source text not null
    check (source in ('trial', 'paid', 'system')),
  plan text
    check (plan is null or plan in ('brand_core', 'brand_growth', 'managed_growth', 'enterprise')),
  actor_user_id uuid
    references public.platform_users(id) on delete set null,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

comment on table public.brand_entitlement_events is
  'Append-only audit trail for Brand trial and paid-plan entitlement transitions.';

alter table public.brand_entitlement_events enable row level security;

revoke all on table public.brand_entitlement_events from anon, authenticated;
grant select, insert on table public.brand_entitlement_events to service_role;
revoke update, delete on table public.brand_entitlement_events from service_role;

create index if not exists brand_entitlement_events_org_time_idx
  on public.brand_entitlement_events (organization_id, occurred_at desc);

commit;
