alter table public.platform_users
  add column if not exists is_test_account boolean not null default false;

comment on column public.platform_users.is_test_account is
  'Internal classification used to exclude non-production test accounts from operational funnel KPIs.';
