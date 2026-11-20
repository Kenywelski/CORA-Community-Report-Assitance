drop policy if exists comments_anon_read on public.report_comments;
create policy comments_anon_read on public.report_comments for select to anon
using (
  is_official
  and exists (
    select 1
    from public.community_reports r
    where r.id = report_id and r.is_public
  )
);

drop policy if exists comments_authenticated_read on public.report_comments;
create policy comments_authenticated_read on public.report_comments for select to authenticated
using (
  private.has_role((select auth.uid()), 'admin')
  or (
    is_official
    and exists (
      select 1
      from public.community_reports r
      where r.id = report_id
        and (
          r.is_public
          or r.user_id = (select auth.uid())
          or public.is_active_staff((select auth.uid()))
        )
    )
  )
);

drop policy if exists comments_authenticated_insert on public.report_comments;
create policy comments_admin_insert on public.report_comments for insert to authenticated
with check (
  user_id = (select auth.uid())
  and is_official
  and private.has_role((select auth.uid()), 'admin')
);
