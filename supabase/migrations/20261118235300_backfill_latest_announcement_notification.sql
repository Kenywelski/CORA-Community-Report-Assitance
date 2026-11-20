with latest_announcement as (
  select
    title,
    coalesce(nullif(btrim(excerpt), ''), content) as body
  from public.announcements
  where is_active
  order by published_at desc, created_at desc
  limit 1
)
insert into public.report_notifications(user_id, type, title, body, link)
select distinct
  resident_role.user_id,
  'announcement',
  latest_announcement.title,
  latest_announcement.body,
  '/updates'
from public.user_roles as resident_role
cross join latest_announcement
where resident_role.role = 'user'::public.app_role
  and not exists (
    select 1
    from public.user_roles as admin_role
    where admin_role.user_id = resident_role.user_id
      and admin_role.role = 'admin'::public.app_role
  )
  and not exists (
    select 1
    from public.report_notifications as existing_notification
    where existing_notification.user_id = resident_role.user_id
      and existing_notification.type = 'announcement'
      and existing_notification.title = latest_announcement.title
      and existing_notification.body is not distinct from latest_announcement.body
      and existing_notification.link = '/updates'
  );
