-- Keep technical platform identity status aligned with Supabase email verification.
-- Unconfirmed users must remain pending until the Auth record confirms the email.
-- Manual suspension/disablement always wins over automatic activation.

create or replace function private.provision_platform_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_auth_status text := case
    when new.email_confirmed_at is null then 'pending'
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

create trigger on_auth_user_created_platform_user
after insert or update of email, email_confirmed_at on auth.users
for each row
execute function private.provision_platform_user();

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
  end;
