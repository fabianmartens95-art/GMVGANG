-- Keep technical platform identity status aligned with Supabase email verification.
-- Hosted Supabase exposes auth.users.email_confirmed_at. The isolated CI fixture intentionally
-- models only id/email/created_at, so this migration detects that capability without weakening
-- production behavior.
-- Manual suspension/disablement always wins over automatic activation.

create or replace function private.provision_platform_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_auth_payload jsonb := to_jsonb(new);
  v_auth_status text := case
    when not (v_auth_payload ? 'email_confirmed_at') then 'active'
    when nullif(v_auth_payload ->> 'email_confirmed_at', '') is null then 'pending'
    else 'active'
  end;
begin
  insert into public.platform_users as pu (id, email, status, created_at, updated_at)
  values (new.id, coalesce(new.email, ''), v_auth_status, now(), now())
  on conflict (id) do update
    set email = excluded.email,
        status = case
          when pu.status in ('suspended', 'disabled') then pu.status
          else excluded.status
        end,
        updated_at = now();

  return new;
end;
$function$;

drop trigger if exists on_auth_user_created_platform_user on auth.users;

-- Do not name email_confirmed_at in the trigger column list: CI's deliberately minimal
-- auth.users fixture omits that hosted-Supabase column. Any auth.users update is safe because
-- the provisioning function is idempotent and preserves suspended/disabled identities.
create trigger on_auth_user_created_platform_user
after insert or update on auth.users
for each row
execute function private.provision_platform_user();

-- Reconcile existing production identities only when the hosted Supabase confirmation column
-- is present. Dynamic SQL keeps this migration executable against the minimal CI fixture.
do $backfill$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'users'
      and column_name = 'email_confirmed_at'
  ) then
    execute $sql$
      update public.platform_users as pu
      set status = case
            when au.email_confirmed_at is null then 'pending'
            else 'active'
          end,
          updated_at = now()
      from auth.users as au
      where pu.id = au.id
        and pu.status in ('pending', 'active')
        and pu.status is distinct from case
          when au.email_confirmed_at is null then 'pending'
          else 'active'
        end
    $sql$;
  end if;
end;
$backfill$;
