create policy community_reports_resident_delete_pending
on public.community_reports
for delete
to authenticated
using (
  user_id = (select auth.uid())
  and status = 'pending'
);
