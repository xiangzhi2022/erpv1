-- A scoped members.read grant must not expose enterprise join applications,
-- and notification lifecycle changes remain behind their guarded RPCs.

drop policy if exists enterprise_join_requests_select
  on public.enterprise_join_requests;
drop policy if exists enterprise_join_requests_select_own
  on public.enterprise_join_requests;

create policy enterprise_join_requests_select
on public.enterprise_join_requests
for select to authenticated
using (
  user_id = (select auth.uid())
  or app_private.has_enterprise_permission(enterprise_id, 'members.manage')
);

drop policy if exists notifications_delete on public.notifications;
revoke delete on table public.notifications from authenticated;
