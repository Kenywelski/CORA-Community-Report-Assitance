-- Resolved reports are final records. Block later edits or deletion at the
-- database boundary so direct API calls cannot bypass the admin UI.
create or replace function private.prevent_resolved_report_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status::text in ('completed', 'closed') then
    raise exception 'Resolved reports can no longer be edited or deleted'
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger community_reports_prevent_resolved_mutation
before update or delete on public.community_reports
for each row execute function private.prevent_resolved_report_mutation();
