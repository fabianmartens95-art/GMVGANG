-- Canonical internal organization used for GMVGANG workforce and Creator portal memberships.
-- The platform deliberately keeps Brand tenants as separate organizations.

insert into public.organizations (type, name, status)
select 'gmvgang', 'GMVGANG', 'active'
where not exists (
  select 1
  from public.organizations
  where type = 'gmvgang'
);

-- There must be exactly one internal GMVGANG organization. Creator registrations
-- can then provision a tenant-local `creator` membership without hard-coding an ID.
create unique index if not exists organizations_single_gmvgang_type_idx
on public.organizations (type)
where type = 'gmvgang';
