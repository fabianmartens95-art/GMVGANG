select
  to_regclass('public.creator_applications') is not null as creator_applications_table_exists,
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'creator_applications'
      and indexname = 'creator_applications_active_handle_unique'
  ) as active_handle_unique_exists,
  relrowsecurity as row_level_security_enabled
from pg_class
where oid = 'public.creator_applications'::regclass;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'creator_applications'
order by grantee, privilege_type;

select tgname
from pg_trigger
where tgrelid = 'public.creator_applications'::regclass
  and not tgisinternal
order by tgname;
