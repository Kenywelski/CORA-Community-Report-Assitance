-- Keep authorization helpers outside the exposed Data API schema.
alter function public.has_role(uuid, public.app_role) set schema private;
alter function public.is_active_staff(uuid) set schema private;
alter function public.get_staff_department(uuid) set schema private;
alter function public.set_user_primary_role(uuid, public.app_role) set schema private;

revoke all on function private.has_role(uuid, public.app_role) from public, anon, authenticated;
revoke all on function private.is_active_staff(uuid) from public, anon, authenticated;
revoke all on function private.get_staff_department(uuid) from public, anon, authenticated;
revoke all on function private.set_user_primary_role(uuid, public.app_role) from public, anon, authenticated;

grant usage on schema private to authenticated;
grant execute on function private.has_role(uuid, public.app_role) to authenticated;
grant execute on function private.is_active_staff(uuid) to authenticated;
grant execute on function private.get_staff_department(uuid) to authenticated;
grant execute on function private.set_user_primary_role(uuid, public.app_role) to authenticated;

-- Recompile the privileged worker after moving it so every reference is schema-qualified.
create or replace function private.set_user_primary_role(
  _user_id uuid,
  _role public.app_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_role((select auth.uid()), 'admin') then
    raise exception 'Only administrators can change account roles';
  end if;

  if _user_id = (select auth.uid()) then
    raise exception 'Administrators cannot change their own primary role';
  end if;

  delete from public.user_roles where user_id = _user_id;
  insert into public.user_roles(user_id, role) values (_user_id, _role);

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('primary_role', _role::text)
  where id = _user_id;
end;
$$;

-- Public RPC remains available to the frontend, but privilege elevation happens only in private.
create or replace function public.set_user_primary_role(
  _user_id uuid,
  _role public.app_role
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.set_user_primary_role(_user_id, _role);
$$;

revoke all on function public.set_user_primary_role(uuid, public.app_role) from public, anon;
grant execute on function public.set_user_primary_role(uuid, public.app_role) to authenticated;

-- Remove duplicate permissive SELECT policies created by FOR ALL admin policies.
drop policy departments_admin_write on public.departments;
create policy departments_admin_insert on public.departments for insert to authenticated
with check (private.has_role((select auth.uid()), 'admin'));
create policy departments_admin_update on public.departments for update to authenticated
using (private.has_role((select auth.uid()), 'admin'))
with check (private.has_role((select auth.uid()), 'admin'));
create policy departments_admin_delete on public.departments for delete to authenticated
using (private.has_role((select auth.uid()), 'admin'));

drop policy report_categories_admin_write on public.report_categories;
create policy report_categories_admin_insert on public.report_categories for insert to authenticated
with check (private.has_role((select auth.uid()), 'admin'));
create policy report_categories_admin_update on public.report_categories for update to authenticated
using (private.has_role((select auth.uid()), 'admin'))
with check (private.has_role((select auth.uid()), 'admin'));
create policy report_categories_admin_delete on public.report_categories for delete to authenticated
using (private.has_role((select auth.uid()), 'admin'));

drop policy announcements_admin_write on public.announcements;
create policy announcements_admin_insert on public.announcements for insert to authenticated
with check (private.has_role((select auth.uid()), 'admin'));
create policy announcements_admin_update on public.announcements for update to authenticated
using (private.has_role((select auth.uid()), 'admin'))
with check (private.has_role((select auth.uid()), 'admin'));
create policy announcements_admin_delete on public.announcements for delete to authenticated
using (private.has_role((select auth.uid()), 'admin'));

drop policy emergency_contacts_admin_write on public.emergency_contacts;
create policy emergency_contacts_admin_insert on public.emergency_contacts for insert to authenticated
with check (private.has_role((select auth.uid()), 'admin'));
create policy emergency_contacts_admin_update on public.emergency_contacts for update to authenticated
using (private.has_role((select auth.uid()), 'admin'))
with check (private.has_role((select auth.uid()), 'admin'));
create policy emergency_contacts_admin_delete on public.emergency_contacts for delete to authenticated
using (private.has_role((select auth.uid()), 'admin'));

drop policy knowledge_base_admin_write on public.knowledge_base;
create policy knowledge_base_admin_insert on public.knowledge_base for insert to authenticated
with check (private.has_role((select auth.uid()), 'admin'));
create policy knowledge_base_admin_update on public.knowledge_base for update to authenticated
using (private.has_role((select auth.uid()), 'admin'))
with check (private.has_role((select auth.uid()), 'admin'));
create policy knowledge_base_admin_delete on public.knowledge_base for delete to authenticated
using (private.has_role((select auth.uid()), 'admin'));

drop policy ai_logs_admin_write on public.ai_logs;
create policy ai_logs_admin_insert on public.ai_logs for insert to authenticated
with check (private.has_role((select auth.uid()), 'admin'));
create policy ai_logs_admin_update on public.ai_logs for update to authenticated
using (private.has_role((select auth.uid()), 'admin'))
with check (private.has_role((select auth.uid()), 'admin'));
create policy ai_logs_admin_delete on public.ai_logs for delete to authenticated
using (private.has_role((select auth.uid()), 'admin'));

drop policy user_roles_admin_write on public.user_roles;
create policy user_roles_admin_insert on public.user_roles for insert to authenticated
with check (private.has_role((select auth.uid()), 'admin'));
create policy user_roles_admin_update on public.user_roles for update to authenticated
using (private.has_role((select auth.uid()), 'admin'))
with check (private.has_role((select auth.uid()), 'admin'));
create policy user_roles_admin_delete on public.user_roles for delete to authenticated
using (private.has_role((select auth.uid()), 'admin'));

drop policy staff_accounts_admin_write on public.staff_accounts;
create policy staff_accounts_admin_insert on public.staff_accounts for insert to authenticated
with check (private.has_role((select auth.uid()), 'admin'));
create policy staff_accounts_admin_update on public.staff_accounts for update to authenticated
using (private.has_role((select auth.uid()), 'admin'))
with check (private.has_role((select auth.uid()), 'admin'));
create policy staff_accounts_admin_delete on public.staff_accounts for delete to authenticated
using (private.has_role((select auth.uid()), 'admin'));

drop policy notifications_own_read on public.report_notifications;
drop policy notifications_admin_read on public.report_notifications;
create policy notifications_own_or_admin_read on public.report_notifications for select to authenticated
using (
  (select auth.uid()) = user_id
  or private.has_role((select auth.uid()), 'admin')
);

-- Cover the two remaining foreign keys flagged by the performance advisor.
create index announcements_created_by_idx on public.announcements(created_by)
where created_by is not null;
create index emergency_contacts_created_by_idx on public.emergency_contacts(created_by)
where created_by is not null;
