create table if not exists public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  brand_master_id text,
  legal_name text,
  website_url text,
  country_code text not null default 'DE' check (country_code ~ '^[A-Z]{2}$'),
  status text not null default 'onboarding' check (status in ('lead', 'qualified', 'onboarding', 'active', 'paused', 'churned')),
  tiktok_shop_status text not null default 'not_connected' check (tiktok_shop_status in ('not_connected', 'setup', 'active', 'paused')),
  primary_goal text not null default 'creator_growth' check (primary_goal in ('creator_growth', 'content_testing', 'shop_growth', 'live_growth', 'profitability')),
  contact_name text,
  contact_email text,
  onboarding_completion_percent integer not null default 0 check (onboarding_completion_percent between 0 and 100),
  next_best_action text not null default 'complete_brand_profile',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (contact_email is null or (contact_email = lower(contact_email) and char_length(contact_email) between 5 and 254)),
  check (website_url is null or char_length(website_url) <= 2048),
  check (char_length(next_best_action) between 1 and 128)
);

create table if not exists public.brand_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  sku text not null check (char_length(sku) between 1 and 128),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  sale_price_cents integer not null default 0 check (sale_price_cents >= 0),
  cogs_cents integer not null default 0 check (cogs_cents >= 0),
  affiliate_commission_bps integer not null default 0 check (affiliate_commission_bps between 0 and 10000),
  sample_cost_cents integer not null default 0 check (sample_cost_cents >= 0),
  inventory_units integer not null default 0 check (inventory_units >= 0),
  tiktok_shop_url text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sku),
  check (tiktok_shop_url is null or char_length(tiktok_shop_url) <= 2048),
  check (image_url is null or char_length(image_url) <= 2048)
);

create table if not exists public.creator_onboarding (
  creator_profile_id uuid primary key references public.creator_profiles(id) on delete cascade,
  follower_count bigint check (follower_count is null or follower_count >= 0),
  content_formats text[] not null default '{}',
  live_status text not null default 'unknown' check (live_status in ('unknown', 'not_live', 'occasional', 'regular')),
  onboarding_status text not null default 'in_progress' check (onboarding_status in ('in_progress', 'complete', 'paused')),
  onboarding_completion_percent integer not null default 0 check (onboarding_completion_percent between 0 and 100),
  next_best_action text not null default 'complete_profile',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(content_formats) <= 8),
  check (content_formats <@ array['shoppable_video','live_shopping','ugc','entertainment_community','reviews','tutorials','lifestyle','other']::text[]),
  check (char_length(next_best_action) between 1 and 128)
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid references public.brand_products(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 200),
  status text not null default 'draft' check (status in ('draft', 'approved', 'active', 'paused', 'completed', 'cancelled')),
  client_approved boolean not null default false,
  creator_list_ref text,
  approved_at timestamptz,
  launched_at timestamptz,
  completed_at timestamptz,
  created_by_user_id uuid references public.platform_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_creator_assignments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  creator_profile_id uuid not null references public.creator_profiles(id) on delete cascade,
  creator_ready boolean not null default false,
  outreach_status text not null default 'queued' check (outreach_status in ('queued', 'ready', 'sent', 'replied', 'accepted', 'declined', 'stopped')),
  outreach_reply text check (outreach_reply is null or outreach_reply in ('accepted', 'declined', 'question')),
  sample_status text not null default 'not_requested' check (sample_status in ('not_requested', 'requested', 'approved', 'rejected', 'ordered', 'shipped', 'delivered', 'content_due', 'posted', 'closed')),
  content_status text not null default 'not_started' check (content_status in ('not_started', 'briefed', 'in_progress', 'posted', 'cancelled')),
  brief_text text,
  posted_at timestamptz,
  gmv_cents bigint not null default 0 check (gmv_cents >= 0),
  orders integer not null default 0 check (orders >= 0),
  commission_cents bigint not null default 0 check (commission_cents >= 0),
  performance_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, creator_profile_id),
  check (brief_text is null or char_length(brief_text) <= 10000)
);

create table if not exists public.content_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.campaign_creator_assignments(id) on delete cascade,
  content_url text not null check (char_length(content_url) between 8 and 2048),
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'approved', 'rejected', 'published')),
  rejection_reason text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (rejection_reason is null or char_length(rejection_reason) <= 2000)
);

create table if not exists public.workspace_activity_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.platform_users(id) on delete set null,
  creator_profile_id uuid references public.creator_profiles(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  event_type text not null check (char_length(event_type) between 1 and 128),
  entity_type text not null check (char_length(entity_type) between 1 and 64),
  entity_id text,
  summary text not null check (char_length(summary) between 1 and 500),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists brand_profiles_organization_id_idx on public.brand_profiles(organization_id);
create index if not exists brand_products_organization_id_idx on public.brand_products(organization_id);
create index if not exists creator_onboarding_status_idx on public.creator_onboarding(onboarding_status);
create index if not exists campaigns_organization_id_idx on public.campaigns(organization_id);
create index if not exists campaigns_product_id_idx on public.campaigns(product_id);
create index if not exists campaign_assignments_campaign_id_idx on public.campaign_creator_assignments(campaign_id);
create index if not exists campaign_assignments_creator_profile_id_idx on public.campaign_creator_assignments(creator_profile_id);
create index if not exists content_submissions_assignment_id_idx on public.content_submissions(assignment_id);
create index if not exists workspace_activity_org_time_idx on public.workspace_activity_events(organization_id, occurred_at desc);
create index if not exists workspace_activity_creator_time_idx on public.workspace_activity_events(creator_profile_id, occurred_at desc);
create index if not exists workspace_activity_actor_time_idx on public.workspace_activity_events(actor_user_id, occurred_at desc);

create or replace trigger brand_profiles_updated_at before update on public.brand_profiles for each row execute function private.set_updated_at();
create or replace trigger brand_products_updated_at before update on public.brand_products for each row execute function private.set_updated_at();
create or replace trigger creator_onboarding_updated_at before update on public.creator_onboarding for each row execute function private.set_updated_at();
create or replace trigger campaigns_updated_at before update on public.campaigns for each row execute function private.set_updated_at();
create or replace trigger campaign_creator_assignments_updated_at before update on public.campaign_creator_assignments for each row execute function private.set_updated_at();
create or replace trigger content_submissions_updated_at before update on public.content_submissions for each row execute function private.set_updated_at();

alter table public.brand_profiles enable row level security;
alter table public.brand_products enable row level security;
alter table public.creator_onboarding enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_creator_assignments enable row level security;
alter table public.content_submissions enable row level security;
alter table public.workspace_activity_events enable row level security;

revoke all on table public.brand_profiles from anon, authenticated;
revoke all on table public.brand_products from anon, authenticated;
revoke all on table public.creator_onboarding from anon, authenticated;
revoke all on table public.campaigns from anon, authenticated;
revoke all on table public.campaign_creator_assignments from anon, authenticated;
revoke all on table public.content_submissions from anon, authenticated;
revoke all on table public.workspace_activity_events from anon, authenticated;

grant select on table public.brand_profiles to authenticated;
grant select on table public.brand_products to authenticated;
grant select on table public.creator_onboarding to authenticated;
grant select on table public.campaigns to authenticated;
grant select on table public.campaign_creator_assignments to authenticated;
grant select on table public.content_submissions to authenticated;
grant select on table public.workspace_activity_events to authenticated;

grant select, insert, update, delete on table public.brand_profiles to service_role;
grant select, insert, update, delete on table public.brand_products to service_role;
grant select, insert, update, delete on table public.creator_onboarding to service_role;
grant select, insert, update, delete on table public.campaigns to service_role;
grant select, insert, update, delete on table public.campaign_creator_assignments to service_role;
grant select, insert, update, delete on table public.content_submissions to service_role;
grant select, insert on table public.workspace_activity_events to service_role;

create policy brand_profiles_select_membership on public.brand_profiles for select to authenticated using (organization_id in (select private.user_org_ids()));
create policy brand_products_select_membership on public.brand_products for select to authenticated using (organization_id in (select private.user_org_ids()));
create policy creator_onboarding_select_self on public.creator_onboarding for select to authenticated using (creator_profile_id = (select private.user_creator_profile_id()));
create policy campaigns_select_membership on public.campaigns for select to authenticated using (organization_id in (select private.user_org_ids()));

create policy campaign_assignments_select_related
on public.campaign_creator_assignments for select to authenticated
using (
  creator_profile_id = (select private.user_creator_profile_id())
  or campaign_id in (
    select c.id from public.campaigns c
    where c.organization_id in (select private.user_org_ids())
  )
);

create policy content_submissions_select_related
on public.content_submissions for select to authenticated
using (
  assignment_id in (
    select a.id from public.campaign_creator_assignments a
    where a.creator_profile_id = (select private.user_creator_profile_id())
       or a.campaign_id in (
         select c.id from public.campaigns c
         where c.organization_id in (select private.user_org_ids())
       )
  )
);

create policy workspace_activity_select_related
on public.workspace_activity_events for select to authenticated
using (
  actor_user_id = (select auth.uid())
  or creator_profile_id = (select private.user_creator_profile_id())
  or organization_id in (select private.user_org_ids())
);

comment on table public.brand_profiles is 'Brand Portal onboarding and lifecycle profile bound to one organization.';
comment on table public.brand_products is 'Brand-owned SKU/product catalog used by campaigns and profitability.';
comment on table public.creator_onboarding is 'Creator self-service onboarding state extending the stable creator profile.';
comment on table public.campaigns is 'Server-authoritative Brand campaign state compatible with campaign-operations lifecycle.';
comment on table public.campaign_creator_assignments is 'Creator opportunity, outreach, sample, content and performance state per campaign.';
comment on table public.content_submissions is 'Creator content deliverables attached to a campaign assignment.';
comment on table public.workspace_activity_events is 'User-readable operational activity feed. Mutations are server-only; visibility is RLS-scoped.';
