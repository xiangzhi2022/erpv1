begin;
select plan(3);

select ok(
  (
    select count(*) = 1
      and bool_and(qual like '%user_id%auth.uid%')
      and bool_and(qual like '%has_enterprise_permission%members.manage%')
      and bool_and(qual not like '%has_permission(enterprise_id%')
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'enterprise_join_requests'
      and policyname = 'enterprise_join_requests_select'
      and cmd = 'SELECT'
  ),
  'join request enterprise reads require enterprise members.manage'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'enterprise_join_requests'
      and policyname = 'enterprise_join_requests_select_own'
  ),
  0::bigint,
  'the redundant legacy own-read policy is removed'
);

select ok(
  not has_table_privilege('authenticated', 'public.notifications', 'DELETE'),
  'authenticated users cannot directly delete notifications'
);

select * from finish();
rollback;
