-- CORA initial database schema for Barangay Purisima.
-- The frontend contract is defined by frontend/integrations/supabase/types.ts.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.announcement_type as enum ('general', 'urgent', 'event');
create type public.app_role as enum ('admin', 'moderator', 'user', 'staff');
create type public.request_status as enum (
  'pending',
  'in_progress',
  'completed',
  'rejected',
  'under_review',
  'assigned',
  'closed'
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text unique,
  description text,
  response_hours integer not null default 72 check (response_hours > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.report_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  keywords text[] not null default '{}',
  default_department_id uuid references public.departments(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  address text,
  barangay text default 'Purisima',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table public.staff_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  position text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  excerpt text,
  content text not null,
  image_url text,
  type public.announcement_type not null default 'general',
  is_active boolean not null default true,
  published_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  department_name text not null,
  service_type text not null,
  contact_number text not null default '',
  address text,
  availability text not null default '24/7',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.knowledge_base (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  content text not null,
  tags text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.community_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  title text not null check (char_length(title) between 3 and 200),
  description text not null check (char_length(description) between 3 and 20000),
  category text not null,
  category_id uuid references public.report_categories(id) on delete set null,
  status public.request_status not null default 'pending',
  location text,
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  photo_url text,
  media_urls text[],
  media_types text[],
  reporter_name text,
  reporter_contact text,
  requested_public boolean not null default false,
  is_public boolean not null default false,
  department_id uuid references public.departments(id) on delete set null,
  assigned_department text,
  assigned_to uuid references auth.users(id) on delete set null,
  acknowledged_at timestamptz,
  response_at timestamptz,
  resolved_at timestamptz,
  due_at timestamptz,
  escalated_at timestamptz,
  action_taken text,
  admin_notes text,
  admin_review_status text not null default 'pending',
  admin_review_notes text,
  admin_overridden boolean not null default false,
  requires_review boolean not null default true,
  ai_category text,
  ai_confidence double precision check (ai_confidence is null or ai_confidence between 0 and 1),
  ai_department_id uuid references public.departments(id) on delete set null,
  ai_priority text,
  ai_reason text,
  ai_processed_at timestamptz,
  ai_validation_status text not null default 'pending',
  ai_validation_confidence double precision check (
    ai_validation_confidence is null or ai_validation_confidence between 0 and 1
  ),
  ai_validation_elements jsonb not null default '{}'::jsonb,
  ai_validation_reason text,
  ai_validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (media_types is null or media_urls is null or cardinality(media_types) = cardinality(media_urls))
);

create table public.ai_logs (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.community_reports(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  action text not null,
  actor text not null default 'system',
  decision text,
  confidence double precision check (confidence is null or confidence between 0 and 1),
  reasoning text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.resident_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  subject text not null check (char_length(subject) between 1 and 200),
  message text not null check (char_length(message) between 1 and 5000),
  rating integer check (rating is null or rating between 1 and 5),
  is_anonymous boolean not null default false,
  is_reviewed boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.report_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid references public.community_reports(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.report_comments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.community_reports(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  author_name text,
  content text not null check (char_length(content) between 1 and 4000),
  is_official boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.report_follows (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.community_reports(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (report_id, user_id)
);

create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('staff', 'ai')),
  status text not null default 'open' check (status in ('open', 'closed', 'archived')),
  title text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  role text not null check (role in ('user', 'admin', 'staff', 'assistant', 'system')),
  content text not null check (char_length(content) between 1 and 10000),
  created_at timestamptz not null default now()
);

create table public.system_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

create table public.user_login_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ip_address inet,
  user_agent text,
  login_at timestamptz not null default now()
);

-- Foreign-key and common-filter indexes.
create index report_categories_department_idx on public.report_categories(default_department_id);
create index user_roles_user_idx on public.user_roles(user_id);
create index staff_accounts_department_idx on public.staff_accounts(department_id);
create index announcements_active_published_idx on public.announcements(published_at desc) where is_active;
create index emergency_contacts_active_order_idx on public.emergency_contacts(sort_order, department_name) where is_active;
create index knowledge_base_category_active_idx on public.knowledge_base(category, created_at desc) where is_active;
create index community_reports_user_created_idx on public.community_reports(user_id, created_at desc);
create index community_reports_status_created_idx on public.community_reports(status, created_at desc);
create index community_reports_department_idx on public.community_reports(department_id, created_at desc);
create index community_reports_category_id_idx on public.community_reports(category_id);
create index community_reports_ai_department_idx on public.community_reports(ai_department_id);
create index community_reports_assigned_to_idx on public.community_reports(assigned_to);
create index community_reports_public_created_idx on public.community_reports(created_at desc)
  where is_public and status <> 'rejected';
create index ai_logs_report_idx on public.ai_logs(report_id, created_at desc);
create index ai_logs_department_idx on public.ai_logs(department_id);
create index resident_feedback_user_idx on public.resident_feedback(user_id, created_at desc);
create index report_notifications_user_unread_idx on public.report_notifications(user_id, created_at desc)
  where read_at is null;
create index report_notifications_report_idx on public.report_notifications(report_id);
create index report_comments_report_created_idx on public.report_comments(report_id, created_at);
create index report_comments_user_idx on public.report_comments(user_id);
create index report_follows_user_idx on public.report_follows(user_id);
create index chat_threads_user_mode_idx on public.chat_threads(user_id, mode, last_message_at desc);
create index chat_messages_thread_created_idx on public.chat_messages(thread_id, created_at);
create index chat_messages_sender_idx on public.chat_messages(sender_id);
create index user_login_activity_user_idx on public.user_login_activity(user_id, login_at desc);

-- Shared timestamp maintenance.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger departments_set_updated_at before update on public.departments
for each row execute function private.set_updated_at();
create trigger report_categories_set_updated_at before update on public.report_categories
for each row execute function private.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
create trigger staff_accounts_set_updated_at before update on public.staff_accounts
for each row execute function private.set_updated_at();
create trigger announcements_set_updated_at before update on public.announcements
for each row execute function private.set_updated_at();
create trigger emergency_contacts_set_updated_at before update on public.emergency_contacts
for each row execute function private.set_updated_at();
create trigger knowledge_base_set_updated_at before update on public.knowledge_base
for each row execute function private.set_updated_at();
create trigger community_reports_set_updated_at before update on public.community_reports
for each row execute function private.set_updated_at();

-- Authorization helpers. These functions never trust user_metadata.
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = _user_id
      and ur.role = _role
      and (
        _user_id = (select auth.uid())
        or exists (
          select 1 from public.user_roles caller
          where caller.user_id = (select auth.uid()) and caller.role = 'admin'
        )
      )
  );
$$;

create or replace function public.is_active_staff(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_accounts sa
    where sa.user_id = _user_id
      and sa.is_active
      and (
        _user_id = (select auth.uid())
        or exists (
          select 1 from public.user_roles caller
          where caller.user_id = (select auth.uid()) and caller.role = 'admin'
        )
      )
  );
$$;

create or replace function public.get_staff_department(_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select sa.department_id
  from public.staff_accounts sa
  where sa.user_id = _user_id
    and sa.is_active
    and (
      _user_id = (select auth.uid())
      or exists (
        select 1 from public.user_roles caller
        where caller.user_id = (select auth.uid()) and caller.role = 'admin'
      )
    )
  limit 1;
$$;

revoke all on function public.has_role(uuid, public.app_role) from public;
revoke all on function public.is_active_staff(uuid) from public;
revoke all on function public.get_staff_department(uuid) from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.is_active_staff(uuid) to authenticated;
grant execute on function public.get_staff_department(uuid) to authenticated;

create or replace function public.set_user_primary_role(
  _user_id uuid,
  _role public.app_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role((select auth.uid()), 'admin') then
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

revoke all on function public.set_user_primary_role(uuid, public.app_role) from public, anon;
grant execute on function public.set_user_primary_role(uuid, public.app_role) to authenticated;

-- Every new Auth user receives a profile and the resident role (`user` in the UI contract).
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(user_id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (user_id) do nothing;

  insert into public.user_roles(user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('primary_role', 'user')
  where id = new.id;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

-- Publish approved reports automatically once processing begins.
create or replace function private.sync_report_publication()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status in ('under_review', 'assigned', 'in_progress', 'completed', 'closed') then
    new.is_public := new.requested_public;
  elsif new.status = 'rejected' then
    new.is_public := false;
  end if;
  return new;
end;
$$;

create trigger community_reports_sync_publication
before insert or update of status, requested_public on public.community_reports
for each row execute function private.sync_report_publication();

-- Staff may update workflow fields but cannot rewrite resident-submitted content or ownership.
create or replace function private.enforce_report_update_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
begin
  if caller_id is null or public.has_role(caller_id, 'admin') then
    return new;
  end if;

  if public.is_active_staff(caller_id) then
    if (
      to_jsonb(new) - array[
        'status', 'acknowledged_at', 'response_at', 'resolved_at', 'due_at',
        'escalated_at', 'action_taken', 'admin_review_status',
        'admin_review_notes', 'requires_review', 'updated_at', 'is_public'
      ]::text[]
    ) is distinct from (
      to_jsonb(old) - array[
        'status', 'acknowledged_at', 'response_at', 'resolved_at', 'due_at',
        'escalated_at', 'action_taken', 'admin_review_status',
        'admin_review_notes', 'requires_review', 'updated_at', 'is_public'
      ]::text[]
    ) then
      raise exception 'Staff may only update report workflow fields';
    end if;
    return new;
  end if;

  raise exception 'You are not allowed to update this report';
end;
$$;

create trigger community_reports_enforce_update_scope
before update on public.community_reports
for each row execute function private.enforce_report_update_scope();

-- Notification automation for report status changes and discussions.
create or replace function private.notify_report_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null and (
    old.status is distinct from new.status
    or old.admin_review_notes is distinct from new.admin_review_notes
    or old.action_taken is distinct from new.action_taken
  ) then
    insert into public.report_notifications(user_id, report_id, type, title, body, link)
    values (
      new.user_id,
      new.id,
      'report_status',
      new.title,
      'Your report is now ' || replace(new.status::text, '_', ' ') || '.',
      '/my-requests'
    );
  end if;
  return new;
end;
$$;

create trigger community_reports_notify_owner
after update on public.community_reports
for each row execute function private.notify_report_update();

create or replace function private.notify_report_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.report_notifications(user_id, report_id, type, title, body, link)
  select recipient.user_id, r.id, 'report_comment', r.title,
    case when new.is_official then 'An official update was posted on your report.'
         else 'A new comment was posted on a report you follow.' end,
    case when recipient.user_id = r.user_id then '/my-requests' else '/community' end
  from public.community_reports r
  cross join lateral (
    select r.user_id where r.user_id is not null
    union
    select rf.user_id from public.report_follows rf where rf.report_id = r.id
  ) recipient
  where r.id = new.report_id
    and recipient.user_id is distinct from new.user_id;
  return new;
end;
$$;

create trigger report_comments_notify_participants
after insert on public.report_comments
for each row execute function private.notify_report_comment();

-- Sanitized public report feed. Reporter identity and internal notes never leave the base table.
create view public.public_report_feed
with (security_invoker = true)
as
select
  r.id,
  r.title,
  r.description,
  r.category,
  r.status,
  r.created_at,
  r.location,
  r.latitude,
  r.longitude,
  r.photo_url,
  r.media_urls,
  r.assigned_department,
  coalesce(r.action_taken, r.admin_review_notes) as admin_notes,
  null::text as reporter_name,
  r.response_at,
  r.resolved_at,
  null::uuid as user_id
from public.community_reports r
where r.is_public and r.status <> 'rejected';

-- Enable RLS on every application table in the exposed public schema.
alter table public.departments enable row level security;
alter table public.report_categories enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.staff_accounts enable row level security;
alter table public.announcements enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.knowledge_base enable row level security;
alter table public.community_reports enable row level security;
alter table public.ai_logs enable row level security;
alter table public.resident_feedback enable row level security;
alter table public.report_notifications enable row level security;
alter table public.report_comments enable row level security;
alter table public.report_follows enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.system_settings enable row level security;
alter table public.user_login_activity enable row level security;

-- Public information policies.
create policy departments_anon_read on public.departments for select to anon
using (is_active);
create policy departments_authenticated_read on public.departments for select to authenticated
using (is_active or public.has_role((select auth.uid()), 'admin'));
create policy departments_admin_write on public.departments for all to authenticated
using (public.has_role((select auth.uid()), 'admin'))
with check (public.has_role((select auth.uid()), 'admin'));

create policy report_categories_anon_read on public.report_categories for select to anon
using (is_active);
create policy report_categories_authenticated_read on public.report_categories for select to authenticated
using (is_active or public.has_role((select auth.uid()), 'admin'));
create policy report_categories_admin_write on public.report_categories for all to authenticated
using (public.has_role((select auth.uid()), 'admin'))
with check (public.has_role((select auth.uid()), 'admin'));

create policy announcements_anon_read on public.announcements for select to anon
using (is_active);
create policy announcements_authenticated_read on public.announcements for select to authenticated
using (is_active or public.has_role((select auth.uid()), 'admin'));
create policy announcements_admin_write on public.announcements for all to authenticated
using (public.has_role((select auth.uid()), 'admin'))
with check (public.has_role((select auth.uid()), 'admin'));

create policy emergency_contacts_anon_read on public.emergency_contacts for select to anon
using (is_active);
create policy emergency_contacts_authenticated_read on public.emergency_contacts for select to authenticated
using (is_active or public.has_role((select auth.uid()), 'admin'));
create policy emergency_contacts_admin_write on public.emergency_contacts for all to authenticated
using (public.has_role((select auth.uid()), 'admin'))
with check (public.has_role((select auth.uid()), 'admin'));

create policy knowledge_base_anon_read on public.knowledge_base for select to anon
using (is_active);
create policy knowledge_base_authenticated_read on public.knowledge_base for select to authenticated
using (is_active or public.has_role((select auth.uid()), 'admin'));
create policy knowledge_base_admin_write on public.knowledge_base for all to authenticated
using (public.has_role((select auth.uid()), 'admin'))
with check (public.has_role((select auth.uid()), 'admin'));

-- Account and role policies.
create policy profiles_own_read on public.profiles for select to authenticated
using ((select auth.uid()) = user_id or public.has_role((select auth.uid()), 'admin'));
create policy profiles_own_insert on public.profiles for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy profiles_own_update on public.profiles for update to authenticated
using ((select auth.uid()) = user_id or public.has_role((select auth.uid()), 'admin'))
with check ((select auth.uid()) = user_id or public.has_role((select auth.uid()), 'admin'));

create policy user_roles_own_or_admin_read on public.user_roles for select to authenticated
using ((select auth.uid()) = user_id or public.has_role((select auth.uid()), 'admin'));
create policy user_roles_admin_write on public.user_roles for all to authenticated
using (public.has_role((select auth.uid()), 'admin'))
with check (public.has_role((select auth.uid()), 'admin'));

create policy staff_accounts_own_or_admin_read on public.staff_accounts for select to authenticated
using ((select auth.uid()) = user_id or public.has_role((select auth.uid()), 'admin'));
create policy staff_accounts_admin_write on public.staff_accounts for all to authenticated
using (public.has_role((select auth.uid()), 'admin'))
with check (public.has_role((select auth.uid()), 'admin'));

create policy login_activity_own_insert on public.user_login_activity for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy login_activity_admin_read on public.user_login_activity for select to authenticated
using (public.has_role((select auth.uid()), 'admin'));

-- Reports and related resident data.
create policy community_reports_public_read on public.community_reports for select to anon
using (is_public and status <> 'rejected');
create policy community_reports_authenticated_read on public.community_reports for select to authenticated
using (
  (is_public and status <> 'rejected')
  or user_id = (select auth.uid())
  or public.has_role((select auth.uid()), 'admin')
  or public.is_active_staff((select auth.uid()))
);
create policy community_reports_resident_insert on public.community_reports for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'pending'
  and not is_public
);
create policy community_reports_staff_admin_update on public.community_reports for update to authenticated
using (
  public.has_role((select auth.uid()), 'admin')
  or public.is_active_staff((select auth.uid()))
)
with check (
  public.has_role((select auth.uid()), 'admin')
  or public.is_active_staff((select auth.uid()))
);
create policy community_reports_admin_delete on public.community_reports for delete to authenticated
using (public.has_role((select auth.uid()), 'admin'));

create policy ai_logs_staff_admin_read on public.ai_logs for select to authenticated
using (public.has_role((select auth.uid()), 'admin') or public.is_active_staff((select auth.uid())));
create policy ai_logs_admin_write on public.ai_logs for all to authenticated
using (public.has_role((select auth.uid()), 'admin'))
with check (public.has_role((select auth.uid()), 'admin'));

create policy feedback_own_insert on public.resident_feedback for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy feedback_own_or_admin_read on public.resident_feedback for select to authenticated
using ((select auth.uid()) = user_id or public.has_role((select auth.uid()), 'admin'));
create policy feedback_admin_update on public.resident_feedback for update to authenticated
using (public.has_role((select auth.uid()), 'admin'))
with check (public.has_role((select auth.uid()), 'admin'));

create policy notifications_own_read on public.report_notifications for select to authenticated
using ((select auth.uid()) = user_id);
create policy notifications_own_update on public.report_notifications for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy notifications_admin_read on public.report_notifications for select to authenticated
using (public.has_role((select auth.uid()), 'admin'));

create policy comments_anon_read on public.report_comments for select to anon
using (
  exists (
    select 1 from public.community_reports r
    where r.id = report_id and r.is_public
  )
);
create policy comments_authenticated_read on public.report_comments for select to authenticated
using (
  exists (
    select 1 from public.community_reports r
    where r.id = report_id
      and (r.is_public or r.user_id = (select auth.uid())
        or public.has_role((select auth.uid()), 'admin')
        or public.is_active_staff((select auth.uid())))
  )
);
create policy comments_authenticated_insert on public.report_comments for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (
    not is_official
    or public.has_role((select auth.uid()), 'admin')
    or public.is_active_staff((select auth.uid()))
  )
  and exists (
    select 1 from public.community_reports r
    where r.id = report_id
      and (r.is_public or r.user_id = (select auth.uid())
        or public.has_role((select auth.uid()), 'admin')
        or public.is_active_staff((select auth.uid())))
  )
);

create policy follows_public_read on public.report_follows for select to anon, authenticated
using (exists (select 1 from public.community_reports r where r.id = report_id and r.is_public));
create policy follows_own_insert on public.report_follows for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.community_reports r where r.id = report_id and r.is_public)
);
create policy follows_own_delete on public.report_follows for delete to authenticated
using (user_id = (select auth.uid()));

-- Resident-to-staff chat policies.
create policy chat_threads_participant_read on public.chat_threads for select to authenticated
using (
  user_id = (select auth.uid())
  or public.has_role((select auth.uid()), 'admin')
  or public.is_active_staff((select auth.uid()))
);
create policy chat_threads_resident_insert on public.chat_threads for insert to authenticated
with check (user_id = (select auth.uid()) and mode = 'staff');
create policy chat_threads_participant_update on public.chat_threads for update to authenticated
using (
  user_id = (select auth.uid())
  or public.has_role((select auth.uid()), 'admin')
  or public.is_active_staff((select auth.uid()))
)
with check (
  user_id = (select auth.uid())
  or public.has_role((select auth.uid()), 'admin')
  or public.is_active_staff((select auth.uid()))
);

create policy chat_messages_participant_read on public.chat_messages for select to authenticated
using (
  exists (
    select 1 from public.chat_threads t
    where t.id = thread_id
      and (t.user_id = (select auth.uid())
        or public.has_role((select auth.uid()), 'admin')
        or public.is_active_staff((select auth.uid())))
  )
);
create policy chat_messages_participant_insert on public.chat_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and (
    (role = 'user' and exists (
      select 1 from public.chat_threads t
      where t.id = thread_id and t.user_id = (select auth.uid())
    ))
    or (
      role in ('admin', 'staff')
      and (public.has_role((select auth.uid()), 'admin') or public.is_active_staff((select auth.uid())))
    )
  )
);

create policy system_settings_admin_all on public.system_settings for all to authenticated
using (public.has_role((select auth.uid()), 'admin'))
with check (public.has_role((select auth.uid()), 'admin'));

-- Explicit Data API grants (new projects do not auto-expose new public tables).
grant usage on schema public to anon, authenticated;
grant select on public.departments, public.report_categories, public.announcements,
  public.emergency_contacts, public.knowledge_base, public.community_reports,
  public.report_comments, public.report_follows, public.public_report_feed to anon;
grant select on all tables in schema public to authenticated;
grant insert, update, delete on all tables in schema public to authenticated;

-- Storage bucket and object policies for report/announcement media.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'public-media',
  'public-media',
  true,
  52428800,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime', 'application/pdf'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy public_media_read on storage.objects for select to anon, authenticated
using (bucket_id = 'public-media');
create policy public_media_owner_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'public-media'
  and (storage.foldername(name))[1] in ('reports', 'announcements')
  and (storage.foldername(name))[2] = (select auth.uid())::text
);
create policy public_media_owner_update on storage.objects for update to authenticated
using (
  bucket_id = 'public-media'
  and ((storage.foldername(name))[2] = (select auth.uid())::text
    or public.has_role((select auth.uid()), 'admin'))
)
with check (
  bucket_id = 'public-media'
  and ((storage.foldername(name))[2] = (select auth.uid())::text
    or public.has_role((select auth.uid()), 'admin'))
);
create policy public_media_owner_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'public-media'
  and ((storage.foldername(name))[2] = (select auth.uid())::text
    or public.has_role((select auth.uid()), 'admin'))
);

-- Realtime tables used by the current frontend subscriptions.
alter publication supabase_realtime add table
  public.announcements,
  public.emergency_contacts,
  public.knowledge_base,
  public.community_reports,
  public.report_comments,
  public.report_follows,
  public.report_notifications,
  public.chat_threads,
  public.chat_messages,
  public.profiles,
  public.user_roles,
  public.staff_accounts,
  public.user_login_activity;

-- Initial departments and report categories.
insert into public.departments(name, slug, description, response_hours) values
  ('Barangay Administration', 'barangay-administration', 'General barangay services and coordination.', 72),
  ('Environment and Waste Management', 'environment-waste', 'Waste collection, illegal dumping, and sanitation concerns.', 48),
  ('Public Works and Infrastructure', 'public-works', 'Roads, drainage, streetlights, and public infrastructure.', 72),
  ('Peace and Order', 'peace-order', 'Community safety and peace-and-order coordination.', 24),
  ('Disaster Risk Reduction and Management', 'disaster-response', 'Disaster preparedness, rescue, and emergency coordination.', 24),
  ('Health and Social Services', 'health-social-services', 'Barangay health and social welfare services.', 48);

insert into public.report_categories(name, description, keywords, default_department_id)
select 'Improper Waste Disposal', 'Uncollected waste, illegal dumping, or roadside litter.',
  array['garbage', 'waste', 'trash', 'dumping'], id
from public.departments where slug = 'environment-waste';
insert into public.report_categories(name, description, keywords, default_department_id)
select 'Streetlight Problem', 'Non-functioning, flickering, or damaged streetlights.',
  array['streetlight', 'lamp', 'lighting', 'dark'], id
from public.departments where slug = 'public-works';
insert into public.report_categories(name, description, keywords, default_department_id)
select 'Drainage/Flooding Concern', 'Clogged drainage, blocked canals, or localized flooding.',
  array['drainage', 'flood', 'canal', 'water'], id
from public.departments where slug = 'public-works';
insert into public.report_categories(name, description, keywords, default_department_id)
select 'Road Damage', 'Potholes, cracked pavement, or damaged public pathways.',
  array['road', 'pothole', 'pavement', 'pathway'], id
from public.departments where slug = 'public-works';

-- Initial programs. Schedules are deliberately marked TBA for barangay verification.
insert into public.knowledge_base(title, category, content, tags, is_active) values
  (
    'Barangay Health and Wellness Services',
    'Barangay Program',
    '{"category":"Health & Wellness","description":"Community health information, basic screening, and wellness activities coordinated by Barangay Purisima.","schedule":"TBA - confirm with the Barangay Health Center","location":"Barangay Purisima, Tago","target_participants":"All Residents","coordinator":"Barangay Purisima Council","status":"Active"}',
    array['program', 'health & wellness', 'purisima'], true
  ),
  (
    'Youth and Education Support',
    'Barangay Program',
    '{"category":"Youth & Education","description":"Youth development and education support activities announced by the barangay.","schedule":"TBA - confirm with the Barangay Hall","location":"Barangay Purisima, Tago","target_participants":"Youth and Students","coordinator":"Barangay Purisima Council","status":"Upcoming"}',
    array['program', 'youth & education', 'purisima'], true
  ),
  (
    'Community Clean-up and Sanitation',
    'Barangay Program',
    '{"category":"Environment & Sanitation","description":"Community clean-up, waste awareness, and sanitation activities for Barangay Purisima.","schedule":"TBA - confirm with the Barangay Hall","location":"Barangay Purisima, Tago","target_participants":"All Residents","coordinator":"Barangay Purisima Council","status":"Active"}',
    array['program', 'environment & sanitation', 'purisima'], true
  ),
  (
    'Disaster Preparedness and Community Safety',
    'Barangay Program',
    '{"category":"Peace & Disaster Preparedness","description":"Preparedness, safety awareness, and response coordination activities.","schedule":"TBA - confirm with the Barangay Hall","location":"Barangay Purisima, Tago","target_participants":"All Residents","coordinator":"Barangay Purisima Council","status":"Upcoming"}',
    array['program', 'peace & disaster preparedness', 'purisima'], true
  );

-- Only the national 911 number is activated initially. Local numbers stay hidden until verified.
insert into public.emergency_contacts(
  department_name, service_type, contact_number, address, availability, sort_order, is_active
) values
  ('National Emergency Hotline', 'Government', '911', 'Philippines', '24/7', 1, true),
  ('Barangay Emergency Hotline', 'Barangay', '', 'Barangay Purisima, Tago, Surigao del Sur', 'To be verified', 2, false),
  ('MDRRMO Tago / Rescue', 'Disaster/Rescue', '', 'Tago, Surigao del Sur', 'To be verified', 3, false),
  ('Tago Municipal Police Station', 'Police', '', 'Tago, Surigao del Sur', 'To be verified', 4, false),
  ('Tago Bureau of Fire Protection', 'Fire', '', 'Tago, Surigao del Sur', 'To be verified', 5, false),
  ('Tago Rural Health Unit', 'Health/Hospital', '', 'Tago, Surigao del Sur', 'To be verified', 6, false),
  ('Tago Municipal Hall', 'Government', '', 'Tago, Surigao del Sur', 'Office hours - to be verified', 7, false);

insert into public.system_settings(key, value, description) values
  ('barangay_identity', '{"name":"Barangay Purisima","municipality":"Tago","province":"Surigao del Sur"}', 'Official CORA locality context'),
  ('admin_bootstrap_required', 'true', 'Set to false after the first administrator is assigned.');
