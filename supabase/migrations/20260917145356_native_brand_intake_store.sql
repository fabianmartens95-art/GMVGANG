create table if not exists public.brand_intakes (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique,
  source text not null default 'website_potential_check' check (source in ('website_potential_check')),
  brand_name text not null check (char_length(brand_name) between 1 and 200),
  website_url text not null check (char_length(website_url) between 8 and 2048),
  category text not null check (category in ('Beauty','Food','Home & Living','Fashion','Electronics','Health & Wellness','Pet','Sonstiges')),
  shop_status smallint not null check (shop_status in (0,5,8,10)),
  demo_fit smallint not null check (demo_fit in (25,18,10,3)),
  creator_fit smallint not null check (creator_fit in (25,18,10,3)),
  content_depth smallint not null check (content_depth in (15,10,5,0)),
  creator_history smallint not null check (creator_history in (10,7,3)),
  margin_score smallint check (margin_score in (15,12,7,2)),
  margin_unknown boolean not null default false,
  samples smallint not null check (samples in (10,7,2)),
  ops smallint not null check (ops in (10,7,3)),
  goal text not null check (goal in ('Shop aufbauen','Creator gewinnen','Content testen','Shop verbessern','LIVE testen','Potenzial klären')),
  contact_name text not null check (char_length(contact_name) between 1 and 200),
  business_email text not null check (business_email = lower(business_email) and char_length(business_email) between 5 and 254),
  note text check (note is null or char_length(note) <= 5000),
  potential_score smallint check (potential_score is null or potential_score between 0 and 100),
  potential_band text not null check (potential_band in ('SEHR HOHES POTENZIAL','GUTES POTENZIAL','POTENZIAL MIT KLAREN HEBELN','AKTUELL SELEKTIV TESTEN','VORAUSSETZUNGEN ZUERST KLÄREN')),
  potential_grade text not null check (potential_grade in ('A – Sehr hoch','B – Hoch','C – Mittel','D – Niedrig')),
  tiktok_shop_live boolean not null,
  assessment_summary text not null check (char_length(assessment_summary) <= 5000),
  source_url text not null check (char_length(source_url) <= 2048),
  status text not null default 'received' check (status in ('received','reviewed','qualified','rejected','converted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brand_intakes_margin_consistency check ((margin_unknown and margin_score is null) or (not margin_unknown and margin_score is not null))
);

comment on table public.brand_intakes is 'Server-only intake store for GMVGANG public Brand potential checks. Browser roles have no table grants.';

alter table public.brand_intakes enable row level security;
revoke all on table public.brand_intakes from public, anon, authenticated;
grant select, insert, update on table public.brand_intakes to service_role;

create index if not exists brand_intakes_created_at_idx on public.brand_intakes (created_at desc);
create index if not exists brand_intakes_business_email_idx on public.brand_intakes (business_email);
create index if not exists brand_intakes_status_idx on public.brand_intakes (status, created_at desc);

create table if not exists public.brand_intake_rate_limits (
  subject_hash text primary key check (char_length(subject_hash) = 64),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 1),
  updated_at timestamptz not null default now()
);

comment on table public.brand_intake_rate_limits is 'Server-only fixed-window abuse protection for unauthenticated Brand intake.';
alter table public.brand_intake_rate_limits enable row level security;
revoke all on table public.brand_intake_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.brand_intake_rate_limits to service_role;

create or replace function public.consume_brand_intake_rate_limit(
  p_subject_hash text,
  p_now timestamptz default now(),
  p_limit integer default 5,
  p_window_seconds integer default 600
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if p_subject_hash is null or char_length(p_subject_hash) <> 64 or p_limit < 1 or p_window_seconds < 1 then
    return false;
  end if;

  insert into public.brand_intake_rate_limits(subject_hash, window_started_at, request_count, updated_at)
  values (p_subject_hash, p_now, 1, p_now)
  on conflict (subject_hash) do update
  set
    window_started_at = case
      when public.brand_intake_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= p_now then p_now
      else public.brand_intake_rate_limits.window_started_at
    end,
    request_count = case
      when public.brand_intake_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= p_now then 1
      else public.brand_intake_rate_limits.request_count + 1
    end,
    updated_at = p_now
  returning request_count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.consume_brand_intake_rate_limit(text, timestamptz, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_brand_intake_rate_limit(text, timestamptz, integer, integer) to service_role;
