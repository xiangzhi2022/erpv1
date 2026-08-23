-- Make production reads follow enterprise/workshop scope without treating a
-- scoped grant as an enterprise-wide permission.

drop policy if exists workers_select on public.workers;
create policy workers_select on public.workers
for select to authenticated
using (
  (
    workers.workshop_id is null
    and (
      app_private.has_enterprise_permission(workers.enterprise_id, 'members.read')
      or app_private.has_enterprise_permission(workers.enterprise_id, 'production.read')
      or app_private.has_enterprise_permission(workers.enterprise_id, 'wages.manage')
    )
  )
  or (
    workers.workshop_id is not null
    and (
      app_private.can_access_workshop(
        workers.enterprise_id,
        'members.read',
        workers.workshop_id
      )
      or app_private.can_access_workshop(
        workers.enterprise_id,
        'production.read',
        workers.workshop_id
      )
      or app_private.can_access_workshop(
        workers.enterprise_id,
        'wages.manage',
        workers.workshop_id
      )
    )
  )
);

drop policy if exists workers_select_self on public.workers;
create policy workers_select_self on public.workers
for select to authenticated
using (
  workers.user_id = (select auth.uid())
  and app_private.is_active_member(workers.enterprise_id)
);

drop policy if exists work_orders_select on public.work_orders;
create policy work_orders_select on public.work_orders
for select to authenticated
using (
  (
    work_orders.workshop_id is null
    and app_private.has_enterprise_permission(
      work_orders.enterprise_id,
      'production.read'
    )
  )
  or (
    work_orders.workshop_id is not null
    and app_private.can_access_workshop(
      work_orders.enterprise_id,
      'production.read',
      work_orders.workshop_id
    )
  )
);

drop policy if exists progress_logs_select on public.progress_logs;
create policy progress_logs_select on public.progress_logs
for select to authenticated
using (
  exists (
    select 1
    from public.work_orders work_order
    where work_order.enterprise_id = progress_logs.enterprise_id
      and work_order.id = progress_logs.work_order_id
      and (
        (
          work_order.workshop_id is null
          and app_private.has_enterprise_permission(
            progress_logs.enterprise_id,
            'production.read'
          )
        )
        or (
          work_order.workshop_id is not null
          and app_private.can_access_workshop(
            progress_logs.enterprise_id,
            'production.read',
            work_order.workshop_id
          )
        )
      )
  )
);
