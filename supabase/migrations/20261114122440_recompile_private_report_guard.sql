-- Recompile the PL/pgSQL guard after authorization helpers moved to private.
create or replace function private.enforce_report_update_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
begin
  if caller_id is null or private.has_role(caller_id, 'admin') then
    return new;
  end if;

  if private.is_active_staff(caller_id) then
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
