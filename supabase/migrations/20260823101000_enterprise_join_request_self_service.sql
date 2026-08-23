create policy enterprise_join_requests_select_own
on public.enterprise_join_requests
for select
to authenticated
using (user_id = (select auth.uid()));

create policy enterprise_join_requests_insert_own
on public.enterprise_join_requests
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'pending'
  and handled_by is null
  and handled_at is null
);

create policy enterprise_join_requests_cancel_own
on public.enterprise_join_requests
for update
to authenticated
using (
  user_id = (select auth.uid())
  and status = 'pending'
)
with check (
  user_id = (select auth.uid())
  and status = 'cancelled'
  and handled_by = (select auth.uid())
);

create policy enterprise_join_requests_resubmit_own
on public.enterprise_join_requests
for update
to authenticated
using (
  user_id = (select auth.uid())
  and status in ('rejected', 'cancelled')
)
with check (
  user_id = (select auth.uid())
  and status = 'pending'
  and handled_by is null
  and handled_at is null
);
