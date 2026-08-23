drop policy if exists order_exchanges_participant_select on public.order_exchanges;
drop policy if exists order_exchanges_participant_insert on public.order_exchanges;
drop policy if exists order_exchanges_participant_update on public.order_exchanges;

create policy order_exchanges_participant_select
on public.order_exchanges
for select
to authenticated
using (
  app_private.has_permission(from_enterprise_id, 'orders.read')
  or app_private.has_permission(to_enterprise_id, 'orders.read')
);

create policy order_exchanges_participant_insert
on public.order_exchanges
for insert
to authenticated
with check (
  enterprise_id = from_enterprise_id
  and app_private.has_permission(from_enterprise_id, 'orders.submit')
);

create policy order_exchanges_participant_update
on public.order_exchanges
for update
to authenticated
using (
  app_private.has_permission(from_enterprise_id, 'orders.update')
  or app_private.has_permission(to_enterprise_id, 'orders.accept')
)
with check (
  app_private.has_permission(from_enterprise_id, 'orders.update')
  or app_private.has_permission(to_enterprise_id, 'orders.accept')
);
