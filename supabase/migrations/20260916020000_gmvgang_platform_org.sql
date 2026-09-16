insert into public.organizations (id, type, name, status)
values ('00000000-0000-4000-8000-000000000001'::uuid, 'gmvgang', 'GMVGANG', 'active')
on conflict (id) do update
set type = excluded.type,
    name = excluded.name,
    status = excluded.status;
