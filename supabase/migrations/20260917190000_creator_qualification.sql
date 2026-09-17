begin;

create table if not exists public.creator_qualifications (
  id uuid primary key default gen_random_uuid(),
  creator_profile_id uuid not null unique references public.creator_profiles(id) on delete cascade,
  schema_version text not null default 'r2-v3.0' check (schema_version = 'r2-v3.0'),
  shop_enabled text not null check (shop_enabled in ('yes', 'no', 'unknown')),
  shop_gmv_30d_band text null check (shop_gmv_30d_band is null or shop_gmv_30d_band in ('none', 'lt_500', '500_2500', '2500_10000', '10000_plus')),
  content_formats text[] not null check (
    cardinality(content_formats) between 1 and 4
    and content_formats <@ array['shoppable_video', 'live_shopping', 'ugc', 'entertainment_community']::text[]
  ),
  live_experience text null check (live_experience is null or live_experience in ('none', 'basic', 'experienced', 'pro')),
  live_frequency text null check (live_frequency is null or live_frequency in ('none', 'weekly_1', 'weekly_2_3', 'weekly_4_plus')),
  live_concurrent_viewers text null check (live_concurrent_viewers is null or live_concurrent_viewers in ('not_live', 'lt_25', '25_100', '100_500', '500_plus')),
  production_style text not null check (production_style in ('faceless', 'face', 'mixed')),
  content_language text not null check (content_language in ('de', 'en', 'de_en', 'other')),
  content_categories text[] not null check (
    cardinality(content_categories) between 1 and 3
    and content_categories <@ array['beauty','fashion','lifestyle','food','tech','fitness','gaming','family','entertainment','home_living','health_wellness','pet','other']::text[]
  ),
  representative_video_url text null,
  agency_binding text not null check (agency_binding in ('none', 'non_exclusive', 'exclusive', 'unsure')),
  videos_per_week_band text not null check (videos_per_week_band in ('weekly_1_2', 'weekly_3_5', 'weekly_6_plus', 'open')),
  sample_turnaround_band text not null check (sample_turnaround_band in ('days_3_5', 'days_6_7', 'days_8_14', 'gt_14')),
  violation_status text not null check (violation_status in ('none', 'resolved', 'active', 'unsure')),
  violation_reason text null check (violation_reason is null or char_length(violation_reason) <= 500),
  submitted_at timestamptz not null,
  updated_at timestamptz not null,
  constraint creator_qualification_shop_gmv_consistency check (
    (shop_enabled = 'yes' and shop_gmv_30d_band is not null)
    or (shop_enabled <> 'yes' and shop_gmv_30d_band is null)
  ),
  constraint creator_qualification_live_consistency check (
    (
      'live_shopping' = any(content_formats)
      and live_experience is not null
      and live_frequency is not null
      and live_concurrent_viewers is not null
    ) or (
      not ('live_shopping' = any(content_formats))
      and live_experience is null
      and live_frequency is null
      and live_concurrent_viewers is null
    )
  ),
  constraint creator_qualification_violation_consistency check (
    (violation_status = 'none' and violation_reason is null)
    or (violation_status <> 'none' and violation_reason is not null and char_length(btrim(violation_reason)) > 0)
  )
);

create index if not exists creator_qualifications_updated_idx
  on public.creator_qualifications(updated_at desc);

alter table public.creator_qualifications enable row level security;
revoke all on public.creator_qualifications from anon, authenticated;
grant select, insert, update, delete on public.creator_qualifications to service_role;

commit;
