-- GMVGANG platform audit hardening.
-- Keep the audit trail append-only for the backend service and unavailable to browser roles.

revoke all on table public.platform_audit_events from service_role;
grant select, insert on table public.platform_audit_events to service_role;

create index if not exists platform_audit_events_org_occurred_idx
  on public.platform_audit_events (organization_id, occurred_at desc)
  where organization_id is not null;

comment on table public.platform_audit_events is
  'Append-only server-side platform audit trail. Browser roles have no table grants; service_role is restricted to SELECT and INSERT.';
