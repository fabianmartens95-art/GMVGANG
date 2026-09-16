-- PENDING / NOT YET APPLIED TO PRODUCTION.
-- Requires the platform foundation migration because it reuses private.set_updated_at().

create table if not exists public.affiliate_performance_measurements (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('tiktok-shop-seller-analytics', 'csv-import', 'notion', 'manual')),
  external_record_id text not null,
  connection_id text,
  grain text not null check (grain in ('shop', 'campaign', 'creator', 'product', 'content')),
  channel text not null check (channel in (
    'total', 'affiliate-total', 'affiliate-video', 'affiliate-live',
    'seller-video', 'seller-live', 'seller-product-card', 'shop-tab', 'unknown'
  )),
  organization_id text not null,
  brand_id text,
  campaign_id text,
  shop_id text,
  product_id text,
  creator_id text,
  content_id text,
  start_date date not null,
  end_date_exclusive date not null,
  time_zone text not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null check (status in ('provisional', 'final')),
  gmv numeric,
  orders numeric,
  units_sold numeric,
  commission numeric,
  refunds numeric,
  refunded_items numeric,
  impressions numeric,
  clicks numeric,
  add_to_cart numeric,
  views numeric,
  creator_posts numeric,
  record_fingerprint text not null check (record_fingerprint ~ '^[a-f0-9]{64}$'),
  coverage_key text not null check (coverage_key ~ '^[a-f0-9]{64}$'),
  first_observed_at timestamptz not null,
  last_observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_record_id),
  unique (coverage_key),
  check (end_date_exclusive > start_date),
  check (last_observed_at >= first_observed_at),
  check (gmv is null or gmv >= 0),
  check (orders is null or orders >= 0),
  check (units_sold is null or units_sold >= 0),
  check (commission is null or commission >= 0),
  check (refunds is null or refunds >= 0),
  check (refunded_items is null or refunded_items >= 0),
  check (impressions is null or impressions >= 0),
  check (clicks is null or clicks >= 0),
  check (add_to_cart is null or add_to_cart >= 0),
  check (views is null or views >= 0),
  check (creator_posts is null or creator_posts >= 0),
  check (
    gmv is not null or orders is not null or units_sold is not null or commission is not null
    or refunds is not null or refunded_items is not null or impressions is not null
    or clicks is not null or add_to_cart is not null or views is not null or creator_posts is not null
  )
);

create index if not exists affiliate_performance_org_start_idx
  on public.affiliate_performance_measurements (organization_id, start_date desc);
create index if not exists affiliate_performance_brand_start_idx
  on public.affiliate_performance_measurements (organization_id, brand_id, start_date desc)
  where brand_id is not null;
create index if not exists affiliate_performance_campaign_start_idx
  on public.affiliate_performance_measurements (organization_id, campaign_id, start_date desc)
  where campaign_id is not null;
create index if not exists affiliate_performance_shop_product_idx
  on public.affiliate_performance_measurements (shop_id, product_id, start_date desc)
  where shop_id is not null and product_id is not null;

create or replace trigger affiliate_performance_updated_at
before update on public.affiliate_performance_measurements
for each row execute function private.set_updated_at();

alter table public.affiliate_performance_measurements enable row level security;

-- This is a server-only measurement table. Browser roles receive no table privileges
-- and no RLS policies. The server-side service role receives only the operations
-- required for ingestion/reconciliation/read models; DELETE is deliberately excluded.
revoke all on table public.affiliate_performance_measurements from anon, authenticated, service_role;
grant select, insert, update on table public.affiliate_performance_measurements to service_role;

comment on table public.affiliate_performance_measurements is
  'Server-only normalized affiliate performance measurements. Technical analytics persistence; Notion remains the operational business SSOT.';
