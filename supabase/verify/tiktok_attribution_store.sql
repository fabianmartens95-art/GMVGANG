-- Run only after the pending TikTok attribution migration has been intentionally activated.
-- Any failed invariant aborts with an exception.

do $$
declare
  table_name text;
  rls_enabled boolean;
  guarded_tables text[] := array[
    'tiktok_creator_identity_links',
    'tiktok_video_identity_links'
  ];
  index_name text;
  required_indexes text[] := array[
    'tiktok_creator_identity_active_external_idx',
    'tiktok_creator_identity_active_internal_idx',
    'tiktok_video_identity_active_external_idx',
    'tiktok_video_identity_active_content_idx'
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

    if has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT')
      or has_table_privilege('authenticated', format('public.%I', table_name), 'INSERT')
      or has_table_privilege('authenticated', format('public.%I', table_name), 'UPDATE')
      or has_table_privilege('authenticated', format('public.%I', table_name), 'DELETE') then
      raise exception 'VERIFY_AUTH_PRIVILEGE:%', table_name;
    end if;

    if not has_table_privilege('service_role', format('public.%I', table_name), 'SELECT')
      or not has_table_privilege('service_role', format('public.%I', table_name), 'INSERT')
      or not has_table_privilege('service_role', format('public.%I', table_name), 'UPDATE') then
      raise exception 'VERIFY_SERVICE_REQUIRED_PRIVILEGE_MISSING:%', table_name;
    end if;

    if has_table_privilege('service_role', format('public.%I', table_name), 'DELETE') then
      raise exception 'VERIFY_SERVICE_DELETE_PRIVILEGE:%', table_name;
    end if;
  end loop;

  foreach index_name in array required_indexes loop
    if not exists (
      select 1 from pg_indexes
      where schemaname = 'public'
        and indexname = index_name
    ) then
      raise exception 'VERIFY_UNIQUE_INDEX_MISSING:%', index_name;
    end if;
  end loop;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'tiktok_creator_identity_immutable'
      and not tgisinternal
  ) then
    raise exception 'VERIFY_CREATOR_IMMUTABILITY_TRIGGER_MISSING';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'tiktok_video_identity_immutable'
      and not tgisinternal
  ) then
    raise exception 'VERIFY_VIDEO_IMMUTABILITY_TRIGGER_MISSING';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name in ('tiktok_creator_identity_links', 'tiktok_video_identity_links')
      and column_name in ('creator_open_id', 'video_id', 'user_name', 'username', 'nick_name')
  ) then
    raise exception 'VERIFY_RAW_TIKTOK_IDENTITY_COLUMN_PRESENT';
  end if;
end;
$$;

select 'GMVGANG TikTok attribution store verification passed' as result;
