-- PENDING / NOT YET APPLIED TO PRODUCTION.
-- Hardens the existing server-only platform audit trail after Supabase advisor review.

-- Preserve audit history: the application service role may append/read audit events,
-- but must not update, delete or truncate existing audit records.
revoke all on table public.platform_audit_events from service_role;
grant select, insert on table public.platform_audit_events to service_role;

-- Cover the existing organization foreign key and common tenant-scoped audit reads.
create index if not exists platform_audit_events_organization_id_idx
  on public.platform_audit_events (organization_id)
  where organization_id is not null;

comment on table public.platform_audit_events is
  'Append-only server-side application audit trail. Browser roles have no access; service_role may only SELECT and INSERT.';
