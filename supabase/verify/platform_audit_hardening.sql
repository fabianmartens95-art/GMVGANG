-- Run only after the pending platform audit hardening migration has been intentionally activated.
-- Any failed invariant aborts with an exception.

do $$
begin
  if to_regclass('public.platform_audit_events') is null then
    raise exception 'VERIFY_PLATFORM_AUDIT_TABLE_MISSING';
  end if;

  if has_table_privilege('anon', 'public.platform_audit_events', 'SELECT')
    or has_table_privilege('anon', 'public.platform_audit_events', 'INSERT')
    or has_table_privilege('anon', 'public.platform_audit_events', 'UPDATE')
    or has_table_privilege('anon', 'public.platform_audit_events', 'DELETE') then
    raise exception 'VERIFY_PLATFORM_AUDIT_ANON_PRIVILEGE';
  end if;

  if has_table_privilege('authenticated', 'public.platform_audit_events', 'SELECT')
    or has_table_privilege('authenticated', 'public.platform_audit_events', 'INSERT')
    or has_table_privilege('authenticated', 'public.platform_audit_events', 'UPDATE')
    or has_table_privilege('authenticated', 'public.platform_audit_events', 'DELETE') then
    raise exception 'VERIFY_PLATFORM_AUDIT_AUTH_PRIVILEGE';
  end if;

  if not has_table_privilege('service_role', 'public.platform_audit_events', 'SELECT')
    or not has_table_privilege('service_role', 'public.platform_audit_events', 'INSERT') then
    raise exception 'VERIFY_PLATFORM_AUDIT_SERVICE_REQUIRED_PRIVILEGE_MISSING';
  end if;

  if has_table_privilege('service_role', 'public.platform_audit_events', 'UPDATE')
    or has_table_privilege('service_role', 'public.platform_audit_events', 'DELETE')
    or has_table_privilege('service_role', 'public.platform_audit_events', 'TRUNCATE') then
    raise exception 'VERIFY_PLATFORM_AUDIT_SERVICE_MUTATION_PRIVILEGE';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'platform_audit_events_organization_id_idx'
  ) then
    raise exception 'VERIFY_PLATFORM_AUDIT_ORGANIZATION_INDEX_MISSING';
  end if;
end;
$$;

select 'GMVGANG platform audit hardening verification passed' as result;
