\set ON_ERROR_STOP on

-- Structural guarantees: every application table in public must be protected by RLS.
do $$
declare
  unguarded text[];
  anon_exposed text[];
  auth_writable text[];
begin
  select array_agg(c.relname order by c.relname)
    into unguarded
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relrowsecurity is distinct from true;

  if coalesce(array_length(unguarded, 1), 0) > 0 then
    raise exception 'SECURITY_INVARIANT_RLS_DISABLED:%', array_to_string(unguarded, ',');
  end if;

  select array_agg(c.relname order by c.relname)
    into anon_exposed
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and (
      has_table_privilege('anon', c.oid, 'SELECT')
      or has_table_privilege('anon', c.oid, 'INSERT')
      or has_table_privilege('anon', c.oid, 'UPDATE')
      or has_table_privilege('anon', c.oid, 'DELETE')
    );

  if coalesce(array_length(anon_exposed, 1), 0) > 0 then
    raise exception 'SECURITY_INVARIANT_ANON_TABLE_ACCESS:%', array_to_string(anon_exposed, ',');
  end if;

  select array_agg(c.relname order by c.relname)
    into auth_writable
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and (
      has_table_privilege('authenticated', c.oid, 'INSERT')
      or has_table_privilege('authenticated', c.oid, 'UPDATE')
      or has_table_privilege('authenticated', c.oid, 'DELETE')
    );

  if coalesce(array_length(auth_writable, 1), 0) > 0 then
    raise exception 'SECURITY_INVARIANT_AUTH_DIRECT_WRITE:%', array_to_string(auth_writable, ',');
  end if;
end;
$$;

-- Server-only stores must stay unreadable from browser-authenticated sessions.
do $$
declare
  table_name text;
  sensitive_tables text[] := array[
    'platform_audit_events',
    'mutation_idempotency',
    'brand_intakes',
    'brand_intake_rate_limits',
    'portal_analytics_events',
    'integration_secret_store',
    'creator_tiktok_connections',
    'creator_tiktok_metrics'
  ];
begin
  foreach table_name in array sensitive_tables loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise exception 'SECURITY_INVARIANT_SENSITIVE_TABLE_MISSING:%', table_name;
    end if;
    if has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT') then
      raise exception 'SECURITY_INVARIANT_SENSITIVE_TABLE_BROWSER_READABLE:%', table_name;
    end if;
  end loop;
end;
$$;

-- Deterministic fixtures for real RLS behavior checks.
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'brand-a@example.test'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'brand-b@example.test'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 'creator-a@example.test'),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd4', 'creator-b@example.test');

insert into public.organizations (id, type, name, status) values
  ('11111111-1111-4111-8111-111111111111', 'brand', 'Brand A', 'active'),
  ('22222222-2222-4222-8222-222222222222', 'brand', 'Brand B', 'active');

insert into public.memberships (user_id, organization_id, role, status) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'brand_member', 'active'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '22222222-2222-4222-8222-222222222222', 'brand_member', 'active');

insert into public.creator_profiles (
  id, user_id, tiktok_handle, network_status, profile_completion_percent, referral_code
) values
  ('33333333-3333-4333-8333-333333333333', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 'creator.a', 'registered', 20, 'SEC-A'),
  ('44444444-4444-4444-8444-444444444444', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4', 'creator.b', 'registered', 20, 'SEC-B');

insert into public.creator_onboarding (creator_profile_id) values
  ('33333333-3333-4333-8333-333333333333'),
  ('44444444-4444-4444-8444-444444444444');

insert into public.brand_profiles (organization_id, legal_name) values
  ('11111111-1111-4111-8111-111111111111', 'Brand A GmbH'),
  ('22222222-2222-4222-8222-222222222222', 'Brand B GmbH');

insert into public.brand_products (id, organization_id, name, sku) values
  ('55555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', 'Product A', 'SKU-A'),
  ('66666666-6666-4666-8666-666666666666', '22222222-2222-4222-8222-222222222222', 'Product B', 'SKU-B');

insert into public.campaigns (id, organization_id, product_id, name) values
  ('77777777-7777-4777-8777-777777777777', '11111111-1111-4111-8111-111111111111', '55555555-5555-4555-8555-555555555555', 'Campaign A'),
  ('88888888-8888-4888-8888-888888888888', '22222222-2222-4222-8222-222222222222', '66666666-6666-4666-8666-666666666666', 'Campaign B');

insert into public.campaign_creator_assignments (id, campaign_id, creator_profile_id) values
  ('99999999-9999-4999-8999-999999999999', '77777777-7777-4777-8777-777777777777', '44444444-4444-4444-8444-444444444444'),
  ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', '88888888-8888-4888-8888-888888888888', '33333333-3333-4333-8333-333333333333');

insert into public.content_submissions (assignment_id, content_url) values
  ('99999999-9999-4999-8999-999999999999', 'https://example.test/a'),
  ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', 'https://example.test/b');

insert into public.workspace_activity_events (
  actor_user_id, organization_id, event_type, entity_type, entity_id, summary, occurred_at
) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'test.brand_a', 'campaign', 'a', 'Brand A event', now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '22222222-2222-4222-8222-222222222222', 'test.brand_b', 'campaign', 'b', 'Brand B event', now());

-- Brand A must never read Brand B tenant data.
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false);

do $$
begin
  if (select count(*) from public.organizations where id in (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222'
  )) <> 1 then
    raise exception 'SECURITY_INVARIANT_CROSS_TENANT_ORGANIZATIONS';
  end if;

  if (select count(*) from public.brand_profiles where organization_id in (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222'
  )) <> 1 then
    raise exception 'SECURITY_INVARIANT_CROSS_TENANT_BRAND_PROFILES';
  end if;

  if (select count(*) from public.brand_products where organization_id in (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222'
  )) <> 1 then
    raise exception 'SECURITY_INVARIANT_CROSS_TENANT_PRODUCTS';
  end if;

  if (select count(*) from public.campaigns where organization_id in (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222'
  )) <> 1 then
    raise exception 'SECURITY_INVARIANT_CROSS_TENANT_CAMPAIGNS';
  end if;

  if (select count(*) from public.campaign_creator_assignments where id in (
    '99999999-9999-4999-8999-999999999999',
    'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
  )) <> 1 then
    raise exception 'SECURITY_INVARIANT_CROSS_TENANT_ASSIGNMENTS';
  end if;

  if (select count(*) from public.content_submissions) <> 1 then
    raise exception 'SECURITY_INVARIANT_CROSS_TENANT_CONTENT';
  end if;

  if (select count(*) from public.workspace_activity_events where organization_id in (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222'
  )) <> 1 then
    raise exception 'SECURITY_INVARIANT_CROSS_TENANT_ACTIVITY';
  end if;

  if (select count(*) from public.creator_profiles) <> 0 then
    raise exception 'SECURITY_INVARIANT_BRAND_SEES_CREATOR_PRIVATE_PROFILE';
  end if;

  begin
    insert into public.brand_products (organization_id, name, sku)
    values ('11111111-1111-4111-8111-111111111111', 'Forbidden write', 'FORBIDDEN');
    raise exception 'SECURITY_INVARIANT_AUTH_WRITE_UNEXPECTEDLY_ALLOWED';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

-- Creator A must only see its own private profile/onboarding, while still seeing its assigned campaign data.
set role authenticated;
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', false);

do $$
begin
  if (select count(*) from public.creator_profiles where id in (
    '33333333-3333-4333-8333-333333333333',
    '44444444-4444-4444-8444-444444444444'
  )) <> 1 then
    raise exception 'SECURITY_INVARIANT_CREATOR_PROFILE_ISOLATION';
  end if;

  if (select count(*) from public.creator_onboarding where creator_profile_id in (
    '33333333-3333-4333-8333-333333333333',
    '44444444-4444-4444-8444-444444444444'
  )) <> 1 then
    raise exception 'SECURITY_INVARIANT_CREATOR_ONBOARDING_ISOLATION';
  end if;

  if (select count(*) from public.campaign_creator_assignments where id in (
    '99999999-9999-4999-8999-999999999999',
    'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
  )) <> 1 then
    raise exception 'SECURITY_INVARIANT_CREATOR_ASSIGNMENT_SCOPE';
  end if;

  if (select count(*) from public.content_submissions) <> 1 then
    raise exception 'SECURITY_INVARIANT_CREATOR_CONTENT_SCOPE';
  end if;
end;
$$;

reset role;

select 'GMVGANG security invariants passed' as result;
