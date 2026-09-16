-- Run after all GMVGANG Supabase migrations. Any failed invariant aborts with an exception.

do $$
declare
  table_name text;
  rls_enabled boolean;
  gmvgang_count integer;
  guarded_tables text[] := array[
    'platform_users',
    'organizations',
    'memberships',
    'creator_profiles',
    'referral_attributions',
    'creator_consents',
    'platform_audit_events'
  ];
begin
  foreach table_name in array guarded_tables loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise exception 'VERIFY_TABLE_MISSING:%', table_name;
    end if;

    select c.relrowsecurity
      into rls_enabled
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = table_name;

    if rls_enabled is distinct from true then
      raise exception 'VERIFY_RLS_DISABLED:%', table_name;
    end if;

    if has_table_privilege('anon', format('public.%I', table_name), 'SELECT')
      or has_table_privilege('anon', format('public.%I', table_name), 'INSERT')
      or has_table_privilege('anon', format('public.%I', table_name), 'UPDATE')
      or has_table_privilege('anon', format('public.%I', table_name), 'DELETE') then
      raise exception 'VERIFY_ANON_PRIVILEGE:%', table_name;
    end if;

    if has_table_privilege('authenticated', format('public.%I', table_name), 'INSERT')
      or has_table_privilege('authenticated', format('public.%I', table_name), 'UPDATE')
      or has_table_privilege('authenticated', format('public.%I', table_name), 'DELETE') then
      raise exception 'VERIFY_AUTH_WRITE_PRIVILEGE:%', table_name;
    end if;
  end loop;

  if has_table_privilege('authenticated', 'public.platform_audit_events', 'SELECT') then
    raise exception 'VERIFY_AUDIT_BROWSER_READABLE';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'on_auth_user_created_platform_user'
      and not tgisinternal
  ) then
    raise exception 'VERIFY_AUTH_PROVISION_TRIGGER_MISSING';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'referral_attributions_immutable_identity'
      and not tgisinternal
  ) then
    raise exception 'VERIFY_REFERRAL_IMMUTABILITY_TRIGGER_MISSING';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'organizations_single_gmvgang_type_idx'
  ) then
    raise exception 'VERIFY_GMVGANG_UNIQUENESS_INDEX_MISSING';
  end if;

  select count(*) into gmvgang_count
  from public.organizations
  where type = 'gmvgang'
    and status = 'active';

  if gmvgang_count <> 1 then
    raise exception 'VERIFY_CANONICAL_GMVGANG_ORG_COUNT:%', gmvgang_count;
  end if;
end;
$$;

select 'GMVGANG platform foundation verification passed' as result;
