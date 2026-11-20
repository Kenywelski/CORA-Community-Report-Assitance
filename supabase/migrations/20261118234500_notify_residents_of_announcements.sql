create or replace function private.notify_residents_of_announcement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not new.is_active then
      return new;
    end if;
  elsif not new.is_active or old.is_active then
    return new;
  end if;

  insert into public.report_notifications(user_id, type, title, body, link)
  select distinct
    resident_role.user_id,
    'announcement',
    new.title,
    coalesce(nullif(btrim(new.excerpt), ''), new.content),
    '/updates'
  from public.user_roles as resident_role
  where resident_role.role = 'user'::public.app_role
    and not exists (
      select 1
      from public.user_roles as admin_role
      where admin_role.user_id = resident_role.user_id
        and admin_role.role = 'admin'::public.app_role
    );

  return new;
end;
$$;

create trigger announcements_notify_residents
after insert or update on public.announcements
for each row execute function private.notify_residents_of_announcement();
