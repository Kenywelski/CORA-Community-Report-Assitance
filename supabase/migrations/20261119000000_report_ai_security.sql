alter table public.profiles
  add column if not exists is_test_account boolean not null default false;

create or replace function private.protect_test_account_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_test_account is distinct from old.is_test_account
    and not coalesce(private.has_role((select auth.uid()), 'admin'), false)
  then
    raise exception 'Only administrators can change test account access';
  end if;
  return new;
end;
$$;

revoke all on function private.protect_test_account_flag() from public, anon, authenticated;

drop trigger if exists profiles_protect_test_account_flag on public.profiles;

create trigger profiles_protect_test_account_flag
before update of is_test_account on public.profiles
for each row execute function private.protect_test_account_flag();

create table if not exists public.report_verification_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  image_sha256 text not null check (image_sha256 ~ '^[0-9a-f]{64}$'),
  predicted_category text not null,
  predicted_confidence double precision not null
    check (predicted_confidence between 0 and 1),
  capture_mode text not null check (capture_mode in ('camera', 'upload')),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_meters double precision not null check (accuracy_meters > 0),
  location_timestamp bigint not null,
  duplicate_status text not null default 'none'
    check (duplicate_status in ('none', 'uncertain', 'confirmed')),
  duplicate_report_id uuid references public.community_reports(id) on delete set null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.report_verification_sessions enable row level security;
revoke all on table public.report_verification_sessions from public, anon, authenticated;
grant all on table public.report_verification_sessions to service_role;

alter table public.community_reports
  add column if not exists verification_session_id uuid unique
    references public.report_verification_sessions(id) on delete set null;

drop policy if exists community_reports_resident_insert on public.community_reports;
