create or replace function public.manage_platform_membership(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_organization_id uuid,
  p_role text,
  p_status text,
  p_occurred_at timestamptz
)
returns table (
  membership_id uuid,
  user_id uuid,
  organization_id uuid,
  role text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_organization_type text;
  v_actor_can_manage boolean := false;
  v_actor_is_founder boolean := false;
  v_membership_id uuid;
  v_previous_status text;
begin
  if p_actor_user_id is null or p_target_user_id is null or p_organization_id is null then
    raise exception 'MEMBERSHIP_IDENTITY_REQUIRED';
  end if;
  if p_occurred_at is null then
    raise exception 'MEMBERSHIP_TIMESTAMP_REQUIRED';
  end if;
  if p_role not in ('founder', 'admin', 'creator_manager', 'brand_manager', 'closer', 'creator', 'brand_member') then
    raise exception 'MEMBERSHIP_ROLE_INVALID';
  end if;
  if p_status not in ('invited', 'active', 'revoked') then
    raise exception 'MEMBERSHIP_STATUS_INVALID';
  end if;

  select o.type
    into v_organization_type
  from public.organizations o
  where o.id = p_organization_id
    and o.status = 'active';
  if not found then
    raise exception 'ORGANIZATION_ACCESS_DENIED';
  end if;

  if not exists (select 1 from public.platform_users u where u.id = p_target_user_id) then
    raise exception 'MEMBERSHIP_TARGET_USER_NOT_FOUND';
  end if;

  select
    coalesce(bool_or(m.role in ('founder', 'admin')), false),
    coalesce(bool_or(m.role = 'founder'), false)
    into v_actor_can_manage, v_actor_is_founder
  from public.memberships m
  join public.organizations actor_org on actor_org.id = m.organization_id
  where m.user_id = p_actor_user_id
    and m.status = 'active'
    and actor_org.type = 'gmvgang'
    and actor_org.status = 'active';

  if not v_actor_can_manage then
    raise exception 'MEMBERSHIP_MANAGEMENT_DENIED';
  end if;
  if p_role = 'founder' then
    raise exception 'FOUNDER_ROLE_PROTECTED';
  end if;
  if p_role = 'admin' and not v_actor_is_founder then
    raise exception 'ADMIN_ROLE_REQUIRES_FOUNDER';
  end if;
  if p_role = 'brand_member' and v_organization_type <> 'brand' then
    raise exception 'MEMBERSHIP_ROLE_SCOPE_MISMATCH';
  end if;
  if p_role in ('admin', 'creator_manager', 'brand_manager', 'closer', 'creator') and v_organization_type <> 'gmvgang' then
    raise exception 'MEMBERSHIP_ROLE_SCOPE_MISMATCH';
  end if;

  select m.id, m.status
    into v_membership_id, v_previous_status
  from public.memberships m
  where m.user_id = p_target_user_id
    and m.organization_id = p_organization_id
    and m.role = p_role
  for update;

  if found then
    if v_previous_status is distinct from p_status then
      update public.memberships m
      set status = p_status,
          updated_at = p_occurred_at
      where m.id = v_membership_id;
    end if;
  else
    if p_status = 'revoked' then
      raise exception 'MEMBERSHIP_NOT_FOUND';
    end if;
    insert into public.memberships (user_id, organization_id, role, status, created_at, updated_at)
    values (p_target_user_id, p_organization_id, p_role, p_status, p_occurred_at, p_occurred_at)
    returning id into v_membership_id;
  end if;

  if v_previous_status is distinct from p_status then
    insert into public.platform_audit_events (event, user_id, organization_id, occurred_at, metadata)
    values (
      'membership.changed',
      p_actor_user_id,
      p_organization_id,
      p_occurred_at,
      jsonb_build_object(
        'membershipId', v_membership_id,
        'targetUserId', p_target_user_id,
        'role', p_role,
        'previousStatus', v_previous_status,
        'status', p_status
      )
    );
  end if;

  return query
  select m.id, m.user_id, m.organization_id, m.role, m.status, m.created_at, m.updated_at
  from public.memberships m
  where m.id = v_membership_id;
end;
$$;

revoke execute on function public.manage_platform_membership(uuid, uuid, uuid, text, text, timestamptz) from public;
revoke execute on function public.manage_platform_membership(uuid, uuid, uuid, text, text, timestamptz) from anon, authenticated;
grant execute on function public.manage_platform_membership(uuid, uuid, uuid, text, text, timestamptz) to service_role;

comment on function public.manage_platform_membership(uuid, uuid, uuid, text, text, timestamptz) is
  'Server-only atomic membership mutation with authorization checks and append-only audit event.';
