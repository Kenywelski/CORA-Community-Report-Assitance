-- Resolved reports stay read-only, but administrators may delete them.
create or replace function private.prevent_resolved_report_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  if old.status::text in ('completed', 'closed') then
    raise exception 'Resolved reports can no longer be edited'
      using errcode = '55000';
  end if;

  return new;
end;
$$;
