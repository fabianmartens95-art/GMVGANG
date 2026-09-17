create table if not exists public.portal_analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  event_name text not null check (
    event_name in (
      'portal.page_view',
      'portal.navigation',
      'portal.sign_out_clicked',
      'creator.registration.submitted',
      'creator.profile.submitted',
      'creator.qualification.submitted'
    )
  ),
  path text not null check (
    char_length(path) between 1 and 512
    and left(path, 1) = '/'
    and position('?' in path) = 0
    and position('#' in path) = 0
  ),
  client_session_id uuid not null,
  request_id text check (request_id is null or char_length(request_id) between 1 and 128),
  properties jsonb not null default '{}'::jsonb check (jsonb_typeof(properties) = 'object'),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

comment on table public.portal_analytics_events is
  'Privacy-minimized authenticated product telemetry for GMVGANG portal journeys. Business state changes remain in platform_audit_events.';

alter table public.portal_analytics_events enable row level security;

revoke all on table public.portal_analytics_events from anon, authenticated;
grant select, insert on table public.portal_analytics_events to service_role;

create index if not exists portal_analytics_events_user_occurred_idx
  on public.portal_analytics_events (user_id, occurred_at desc);

create index if not exists portal_analytics_events_event_occurred_idx
  on public.portal_analytics_events (event_name, occurred_at desc);

create index if not exists portal_analytics_events_org_occurred_idx
  on public.portal_analytics_events (organization_id, occurred_at desc)
  where organization_id is not null;
