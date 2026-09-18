-- Read-only verification for Creator Brand visibility persistence.

select
  c.relname as table_name,
  c.relrowsecurity as row_security_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('creator_brand_visibility', 'creator_brand_visibility_events')
order by c.relname;

select
  grantee,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('creator_brand_visibility', 'creator_brand_visibility_events')
order by table_name, grantee, privilege_type;

select
  conname,
  pg_get_constraintdef(oid)
from pg_constraint
where conrelid in (
  'public.creator_brand_visibility'::regclass,
  'public.creator_brand_visibility_events'::regclass
)
order by conrelid::regclass::text, conname;
