drop policy if exists enterprises_select_partner_directory on public.enterprises;

create policy enterprises_select_partner_directory
on public.enterprises
for select
to authenticated
using (
  status = 'active'
  and enterprise_type in ('manufacturer', 'dealer', 'supplier')
  and exists (
    select 1
    from public.enterprise_memberships membership
    where membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and app_private.has_permission(membership.tenant_id, 'partners.read')
  )
);
