-- Run after activating the affiliate performance store migration.
-- Any failed invariant aborts with an exception.

do $$
declare
  rls_enabled boolean;
  policy_count integer;
begin
  if to_regclass('public.affiliate_performance_measurements') is null then
    raise exception 'VERIFY_AFFILIATE_PERFORMANCE_TABLE_MISSING';
  end if;

  select c.relrowsecurity
    into rls_enabled
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'affiliate_performance_measurements';

  if rls_enabled is distinct from true then
    raise exception 'VERIFY_AFFILIATE_PERFORMANCE_RLS_DISABLED';
  end if;

  if has_table_privilege('anon', 'public.affiliate_performance_measurements', 'SELECT')
    or has_table_privilege('anon', 'public.affiliate_performance_measurements', 'INSERT')
    or has_table_privilege('anon', 'public.affiliate_performance_measurements', 'UPDATE')
    or has_table_privilege('anon', 'public.affiliate_performance_measurements', 'DELETE') then
    raise exception 'VERIFY_AFFILIATE_PERFORMANCE_ANON_PRIVILEGE';
  end if;

  if has_table_privilege('authenticated', 'public.affiliate_performance_measurements', 'SELECT')
    or has_table_privilege('authenticated', 'public.affiliate_performance_measurements', 'INSERT')
    or has_table_privilege('authenticated', 'public.affiliate_performance_measurements', 'UPDATE')
    or has_table_privilege('authenticated', 'public.affiliate_performance_measurements', 'DELETE') then
    raise exception 'VERIFY_AFFILIATE_PERFORMANCE_AUTH_PRIVILEGE';
  end if;

  if not has_table_privilege('service_role', 'public.affiliate_performance_measurements', 'SELECT')
    or not has_table_privilege('service_role', 'public.affiliate_performance_measurements', 'INSERT')
    or not has_table_privilege('service_role', 'public.affiliate_performance_measurements', 'UPDATE') then
    raise exception 'VERIFY_AFFILIATE_PERFORMANCE_SERVICE_ROLE_PRIVILEGE_MISSING';
  end if;

  if has_table_privilege('service_role', 'public.affiliate_performance_measurements', 'DELETE') then
    raise exception 'VERIFY_AFFILIATE_PERFORMANCE_SERVICE_ROLE_DELETE_ALLOWED';
  end if;

  select count(*) into policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'affiliate_performance_measurements';

  if policy_count <> 0 then
    raise exception 'VERIFY_AFFILIATE_PERFORMANCE_BROWSER_POLICY_PRESENT:%', policy_count;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.affiliate_performance_measurements'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (provider, external_record_id)'
  ) then
    raise exception 'VERIFY_AFFILIATE_PERFORMANCE_IDENTITY_UNIQUE_MISSING';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.affiliate_performance_measurements'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (coverage_key)'
  ) then
    raise exception 'VERIFY_AFFILIATE_PERFORMANCE_COVERAGE_UNIQUE_MISSING';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.affiliate_performance_measurements'::regclass
      and tgname = 'affiliate_performance_updated_at'
      and not tgisinternal
  ) then
    raise exception 'VERIFY_AFFILIATE_PERFORMANCE_UPDATED_AT_TRIGGER_MISSING';
  end if;
end;
$$;

select 'GMVGANG affiliate performance store verification passed' as result;
