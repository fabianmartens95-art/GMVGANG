revoke delete, update, truncate, references, trigger
  on table public.portal_analytics_events
  from service_role;

grant select, insert
  on table public.portal_analytics_events
  to service_role;
