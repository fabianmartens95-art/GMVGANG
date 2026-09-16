create table if not exists public.creator_applications (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  display_name text not null,
  email text not null,
  phone text,
  tiktok_handle text not null,
  follower_count bigint not null check (follower_count between 0 and 2000000000),
  follower_band text not null check (follower_band in ('0-1k', '1k-10k', '10k-50k', '50k-100k', '100k+')),
  content_categories text[] not null,
  tiktok_shop_experience text not null check (tiktok_shop_experience in ('none', 'affiliate', 'live', 'affiliate_and_live')),
  referral_code text,
  source text not null default 'website' check (source in ('website', 'tally', 'manual')),
  status text not null default 'new' check (status in ('new', 'screening', 'detail_requested', 'accepted', 'rejected', 'withdrawn')),
  age_confirmed boolean not null,
  privacy_accepted boolean not null,
  privacy_notice_version text not null,
  operations_sync_status text not null default 'pending' check (operations_sync_status in ('pending', 'synced', 'failed')),
  operations_sync_last_error text,
  submitted_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email = lower(email)),
  check (tiktok_handle = lower(tiktok_handle)),
  check (tiktok_handle !~ '^@'),
  check (age_confirmed = true),
  check (privacy_accepted = true),
  check (cardinality(content_categories) between 1 and 5)
);

create unique index if not exists creator_applications_active_handle_unique
on public.creator_applications(tiktok_handle)
where status in ('new', 'screening', 'detail_requested', 'accepted');

create index if not exists creator_applications_email_idx on public.creator_applications(email);
create index if not exists creator_applications_status_idx on public.creator_applications(status, submitted_at desc);
create index if not exists creator_applications_sync_idx on public.creator_applications(operations_sync_status, submitted_at);

create or replace trigger creator_applications_updated_at
before update on public.creator_applications
for each row execute function private.set_updated_at();

create or replace function private.audit_creator_application_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.platform_audit_events (event, occurred_at, metadata)
  values (
    'creator.application.created',
    new.submitted_at,
    jsonb_build_object(
      'applicationId', new.id,
      'source', new.source,
      'tiktokHandle', new.tiktok_handle,
      'status', new.status
    )
  );
  return new;
end;
$$;

revoke all on function private.audit_creator_application_created() from public;

create or replace trigger creator_applications_audit_created
after insert on public.creator_applications
for each row execute function private.audit_creator_application_created();

alter table public.creator_applications enable row level security;

revoke all on table public.creator_applications from anon, authenticated;
grant select, insert, update on table public.creator_applications to service_role;

comment on table public.creator_applications is 'Server-only pre-account Creator application intake. Website clients never receive direct table access.';
comment on column public.creator_applications.idempotency_key is 'Client request idempotency key; unique across application submissions.';
comment on column public.creator_applications.follower_band is 'Server-derived follower band for qualification/analytics; follower_count retains the submitted exact count.';
comment on column public.creator_applications.operations_sync_status is 'Best-effort downstream operations sync state; the application row remains canonical even if downstream sync fails.';
