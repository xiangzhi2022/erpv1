begin;

select no_plan();

select is(
  (
    select constraint_info.confdeltype::text
    from pg_constraint constraint_info
    where constraint_info.conrelid = 'public.tasks'::regclass
      and constraint_info.conname = 'tasks_category_enterprise_fk'
  ),
  'r',
  'deleting a category is restricted while tasks still reference it'
);

select ok(
  exists (
    select 1
    from pg_constraint constraint_info
    where constraint_info.conrelid = 'public.tasks'::regclass
      and constraint_info.conname = 'tasks_completed_status_consistency'
      and constraint_info.contype = 'c'
  ),
  'tasks enforce completed if and only if status is completed'
);

select ok(
  exists (
    select 1
    from pg_constraint constraint_info
    where constraint_info.conrelid = 'public.notifications'::regclass
      and constraint_info.conname = 'notifications_recipient_membership_fk'
      and constraint_info.contype = 'f'
  ),
  'notification recipients reference an enterprise membership when present'
);

select ok(
  exists (
    select 1
    from pg_constraint constraint_info
    where constraint_info.conrelid = 'public.tasks'::regclass
      and constraint_info.conname = 'tasks_assignee_membership_fk'
      and constraint_info.contype = 'f'
  ),
  'task assignee ids reference a membership in the same enterprise when present'
);

select ok(
  (select qual from pg_policies
   where schemaname = 'public' and tablename = 'notifications'
     and policyname = 'notifications_select') ~ 'recipient_id.*auth.uid.*notifications.read'
  and
  (select qual from pg_policies
   where schemaname = 'public' and tablename = 'notifications'
     and policyname = 'notifications_select') ~ 'notifications.manage',
  'notification reads are recipient-aware while enterprise managers retain full access'
);

select is_empty(
  $$
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and cmd = 'UPDATE'
  $$,
  'notifications have no broad direct update policy'
);

select ok(
  not has_table_privilege('authenticated', 'public.notifications', 'INSERT')
  and not has_table_privilege('authenticated', 'public.notifications', 'UPDATE'),
  'authenticated callers cannot bypass notification RPCs with direct writes'
);

select ok(
  not has_table_privilege('authenticated', 'public.tasks', 'INSERT')
  and not has_table_privilege('authenticated', 'public.tasks', 'UPDATE'),
  'authenticated callers cannot bypass atomic task write RPCs'
);

select ok(
  to_regprocedure('public.mark_notification_read(uuid,uuid)') is not null
  and to_regprocedure('public.mark_all_notifications_read(uuid)') is not null,
  'narrow notification read-state RPCs exist'
);

select ok(
  to_regprocedure('public.toggle_task(uuid,uuid,boolean)') is not null,
  'atomic task toggle RPC exists'
);

select ok(
  to_regprocedure('public.create_task_notification(uuid,uuid,uuid,text,text,text)') is not null,
  'atomic task notification RPC exists'
);

select ok(
  to_regprocedure('public.create_task_with_notification(uuid,jsonb)') is not null
  and to_regprocedure('public.update_task_with_notification(uuid,uuid,jsonb)') is not null,
  'task writes and assignment notifications have atomic RPCs'
);

select is(
  (select pg_get_userbyid(proowner)
   from pg_proc
   where oid = 'public.toggle_task(uuid,uuid,boolean)'::regprocedure),
  'v2_function_owner',
  'task toggle RPC has the dedicated function owner'
);

select ok(
  has_function_privilege('authenticated', 'public.toggle_task(uuid,uuid,boolean)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.mark_notification_read(uuid,uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.mark_all_notifications_read(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.create_task_notification(uuid,uuid,uuid,text,text,text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.create_task_with_notification(uuid,jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.update_task_with_notification(uuid,uuid,jsonb)', 'EXECUTE'),
  'authenticated callers can execute only the guarded public RPC entry points'
);

select ok(
  not has_function_privilege('anon', 'public.toggle_task(uuid,uuid,boolean)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.mark_notification_read(uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.mark_all_notifications_read(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.create_task_notification(uuid,uuid,uuid,text,text,text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.create_task_with_notification(uuid,jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.update_task_with_notification(uuid,uuid,jsonb)', 'EXECUTE'),
  'anonymous callers cannot execute task or notification RPCs'
);

select ok(
  has_table_privilege('v2_function_owner', 'public.tasks', 'SELECT')
  and has_table_privilege('v2_function_owner', 'public.tasks', 'UPDATE')
  and has_table_privilege('v2_function_owner', 'public.notifications', 'SELECT')
  and has_table_privilege('v2_function_owner', 'public.notifications', 'INSERT')
  and has_table_privilege('v2_function_owner', 'public.notifications', 'UPDATE')
  and not has_table_privilege('v2_function_owner', 'public.tasks', 'DELETE')
  and not has_table_privilege('v2_function_owner', 'public.notifications', 'DELETE'),
  'RPC owner has the required table privileges without delete access'
);

insert into public.enterprises (id, code, name, enterprise_type) values
  ('31000000-0000-4000-8000-000000000001', 'task-safe-a', 'Task safety enterprise A', 'manufacturer'),
  ('32000000-0000-4000-8000-000000000002', 'task-safe-b', 'Task safety enterprise B', 'dealer');

insert into auth.users (id, email, created_at, updated_at) values
  ('31000000-0000-4000-8000-000000000011', 'task-manager@example.invalid', now(), now()),
  ('31000000-0000-4000-8000-000000000012', 'notification-reader@example.invalid', now(), now()),
  ('31000000-0000-4000-8000-000000000013', 'notification-other@example.invalid', now(), now()),
  ('31000000-0000-4000-8000-000000000014', 'notification-inactive@example.invalid', now(), now()),
  ('32000000-0000-4000-8000-000000000021', 'task-outsider@example.invalid', now(), now());

insert into public.enterprise_memberships
  (id, tenant_id, user_id, status, display_name)
values
  ('31000000-0000-4000-8000-000000000101', '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000011', 'active', 'Task manager'),
  ('31000000-0000-4000-8000-000000000102', '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000012', 'active', 'Notification reader'),
  ('31000000-0000-4000-8000-000000000103', '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000013', 'active', 'Notification other'),
  ('31000000-0000-4000-8000-000000000104', '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000014', 'suspended', 'Notification inactive'),
  ('32000000-0000-4000-8000-000000000121', '32000000-0000-4000-8000-000000000002', '32000000-0000-4000-8000-000000000021', 'active', 'Task outsider');

insert into public.roles (id, tenant_id, code, name, is_system) values
  ('31000000-0000-4000-8000-000000000201', '31000000-0000-4000-8000-000000000001', 'task_safety_manager', 'Task safety manager', false),
  ('31000000-0000-4000-8000-000000000202', '31000000-0000-4000-8000-000000000001', 'task_safety_reader', 'Task safety reader', false),
  ('31000000-0000-4000-8000-000000000203', '31000000-0000-4000-8000-000000000001', 'task_safety_other', 'Task safety other', false),
  ('32000000-0000-4000-8000-000000000221', '32000000-0000-4000-8000-000000000002', 'task_safety_outsider', 'Task safety outsider', false);

insert into public.role_permissions (tenant_id, role_id, permission_code) values
  ('31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000201', 'tasks.manage'),
  ('31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000201', 'tasks.read'),
  ('31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000201', 'notifications.manage'),
  ('31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000202', 'notifications.read'),
  ('31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000203', 'notifications.read'),
  ('32000000-0000-4000-8000-000000000002', '32000000-0000-4000-8000-000000000221', 'notifications.read');

insert into public.role_bindings (tenant_id, role_id, membership_id, scope_kind) values
  ('31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000201', '31000000-0000-4000-8000-000000000101', 'enterprise'),
  ('31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000202', '31000000-0000-4000-8000-000000000102', 'enterprise'),
  ('31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000202', '31000000-0000-4000-8000-000000000104', 'enterprise'),
  ('31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000203', '31000000-0000-4000-8000-000000000103', 'enterprise'),
  ('32000000-0000-4000-8000-000000000002', '32000000-0000-4000-8000-000000000221', '32000000-0000-4000-8000-000000000121', 'enterprise');

insert into public.categories (id, enterprise_id, name) values
  ('31000000-0000-4000-8000-000000000301', '31000000-0000-4000-8000-000000000001', 'Referenced category');

insert into public.tasks
  (id, enterprise_id, title, status, category_id, assignee_id, completed)
values
  ('31000000-0000-4000-8000-000000000401', '31000000-0000-4000-8000-000000000001', 'Toggle task', 'pending', '31000000-0000-4000-8000-000000000301', '31000000-0000-4000-8000-000000000012', false),
  ('31000000-0000-4000-8000-000000000402', '31000000-0000-4000-8000-000000000001', 'Other recipient task', 'pending', null, '31000000-0000-4000-8000-000000000013', false);

select throws_ok(
  $$delete from public.categories where id = '31000000-0000-4000-8000-000000000301'$$,
  '23503',
  'update or delete on table "categories" violates foreign key constraint "tasks_category_enterprise_fk" on table "tasks"',
  'a referenced category cannot cascade-delete its tasks'
);

select throws_ok(
  $$
    insert into public.tasks (enterprise_id, title, status, completed)
    values ('31000000-0000-4000-8000-000000000001', 'Inconsistent task', 'completed', false)
  $$,
  '23514',
  'new row for relation "tasks" violates check constraint "tasks_completed_status_consistency"',
  'new task writes cannot disagree on completed and status'
);

insert into public.notifications
  (id, enterprise_id, task_id, recipient_id, type, title)
values
  ('31000000-0000-4000-8000-000000000501', '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000401', '31000000-0000-4000-8000-000000000012', 'due_soon', 'Reader due soon'),
  ('31000000-0000-4000-8000-000000000502', '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000402', '31000000-0000-4000-8000-000000000013', 'overdue', 'Other overdue'),
  ('31000000-0000-4000-8000-000000000503', '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000401', '31000000-0000-4000-8000-000000000012', 'overdue', 'Reader overdue');

select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000012', true);
set local role authenticated;

select results_eq(
  $$select title from public.notifications order by title$$,
  $$values ('Reader due soon'::text), ('Reader overdue'::text)$$,
  'a notification reader sees only notifications addressed to them'
);

select lives_ok(
  $$select public.mark_notification_read('31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000501')$$,
  'a notification reader can mark their own notification read'
);

select results_eq(
  $$select public.mark_all_notifications_read('31000000-0000-4000-8000-000000000001')$$,
  $$values (1::bigint)$$,
  'mark all updates only the remaining unread notifications for the caller'
);

select throws_ok(
  $$select public.mark_notification_read('31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000502')$$,
  'P0002',
  'NOTIFICATION_NOT_FOUND',
  'a reader cannot mark another recipient notification'
);

select throws_ok(
  $$select public.toggle_task('31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000401', false)$$,
  '42501',
  'TASK_MANAGE_FORBIDDEN',
  'task toggles require tasks.manage'
);

reset role;
select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000014', true);
set local role authenticated;

select throws_ok(
  $$select public.mark_all_notifications_read('31000000-0000-4000-8000-000000000001')$$,
  '42501',
  'NOTIFICATION_READ_FORBIDDEN',
  'an inactive membership cannot use notification read-state RPCs'
);

reset role;
select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000011', true);
set local role authenticated;

select results_eq(
  $$select count(*)::bigint from public.notifications$$,
  $$values (3::bigint)$$,
  'a notification manager can read all notifications in the enterprise'
);

select results_eq(
  $$select completed from public.toggle_task('31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000401', false)$$,
  $$values (true)$$,
  'task toggle atomically flips the expected state'
);

select results_eq(
  $$select status from public.tasks where id = '31000000-0000-4000-8000-000000000401'$$,
  $$values ('completed'::text)$$,
  'task toggle preserves the completed and status invariant'
);

select throws_ok(
  $$select public.toggle_task('31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000401', false)$$,
  'P0001',
  'TASK_STATE_CONFLICT',
  'a stale task toggle is rejected instead of losing an update'
);

select lives_ok(
  $$
    select public.create_task_notification(
      '31000000-0000-4000-8000-000000000001',
      '31000000-0000-4000-8000-000000000401',
      '31000000-0000-4000-8000-000000000012',
      'assignment',
      'Task assigned',
      'You have a task'
    )
  $$,
  'a task manager can create an assignment notification for the active assignee'
);

select lives_ok(
  $$
    select public.create_task_notification(
      '31000000-0000-4000-8000-000000000001',
      '31000000-0000-4000-8000-000000000401',
      '31000000-0000-4000-8000-000000000012',
      'assignment',
      'Task assigned retry',
      'Retry must not duplicate'
    )
  $$,
  'retrying assignment notification creation is idempotent'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.notifications
    where enterprise_id = '31000000-0000-4000-8000-000000000001'
      and task_id = '31000000-0000-4000-8000-000000000401'
      and recipient_id = '31000000-0000-4000-8000-000000000012'
      and type = 'assignment'
  $$,
  $$values (1::bigint)$$,
  'assignment notification retries produce one row'
);

select results_eq(
  $$
    select (public.create_task_notification(
      '31000000-0000-4000-8000-000000000001',
      '31000000-0000-4000-8000-000000000402',
      '31000000-0000-4000-8000-000000000013',
      'due_soon',
      'Task due soon',
      null
    ) ->> 'created')::boolean
  $$,
  $$values (true)$$,
  'the first due-soon check creates a notification'
);

select results_eq(
  $$
    select (public.create_task_notification(
      '31000000-0000-4000-8000-000000000001',
      '31000000-0000-4000-8000-000000000402',
      '31000000-0000-4000-8000-000000000013',
      'due_soon',
      'Task due soon retry',
      null
    ) ->> 'created')::boolean
  $$,
  $$values (false)$$,
  'a due-soon retry reports that no duplicate row was created'
);

select throws_ok(
  $$
    select public.create_task_notification(
      '31000000-0000-4000-8000-000000000001',
      '31000000-0000-4000-8000-000000000401',
      '31000000-0000-4000-8000-000000000014',
      'assignment',
      'Inactive assignment',
      null
    )
  $$,
  'P0002',
  'ACTIVE_ASSIGNEE_NOT_FOUND',
  'assignment notifications reject inactive recipients'
);

select results_eq(
  $$
    select (public.create_task_with_notification(
      '31000000-0000-4000-8000-000000000001',
      jsonb_build_object(
        'title', 'Atomic assigned task',
        'status', 'pending',
        'priority', 1,
        'assignee_id', '31000000-0000-4000-8000-000000000012'
      )
    ) -> 'notification' ->> 'recipient_id')::uuid
  $$,
  $$values ('31000000-0000-4000-8000-000000000012'::uuid)$$,
  'task creation atomically creates its assignment notification'
);

select results_eq(
  $$
    select public.create_task_with_notification(
      '31000000-0000-4000-8000-000000000001',
      jsonb_build_object('title', 'Free text assignee task', 'assignee_name', 'External collaborator')
    ) -> 'task' ->> 'assignee_name'
  $$,
  $$values ('External collaborator'::text)$$,
  'task creation preserves free-text assignees when no member id is supplied'
);

select results_eq(
  $$
    with changed as (
      select public.update_task_with_notification(
        '31000000-0000-4000-8000-000000000001',
        '31000000-0000-4000-8000-000000000402',
        jsonb_build_object('assignee_id', '31000000-0000-4000-8000-000000000012')
      ) as result
    )
    select (result -> 'notification' ->> 'recipient_id')::uuid from changed
  $$,
  $$values ('31000000-0000-4000-8000-000000000012'::uuid)$$,
  'task reassignment and its notification commit through one RPC'
);

select lives_ok(
  $$
    select public.update_task_with_notification(
      '31000000-0000-4000-8000-000000000001',
      '31000000-0000-4000-8000-000000000402',
      jsonb_build_object('assignee_id', '31000000-0000-4000-8000-000000000013')
    )
  $$,
  'a task can be reassigned away from a previous recipient'
);

select lives_ok(
  $$
    select public.update_task_with_notification(
      '31000000-0000-4000-8000-000000000001',
      '31000000-0000-4000-8000-000000000402',
      jsonb_build_object('assignee_id', '31000000-0000-4000-8000-000000000012')
    )
  $$,
  'a task can be assigned back to a previous recipient'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.notifications
    where enterprise_id = '31000000-0000-4000-8000-000000000001'
      and task_id = '31000000-0000-4000-8000-000000000402'
      and recipient_id = '31000000-0000-4000-8000-000000000012'
      and type = 'assignment'
  $$,
  $$values (2::bigint)$$,
  'A to B to A reassignment creates a fresh notification for the new assignment event'
);

reset role;

insert into auth.users (id, email, created_at, updated_at)
values ('31000000-0000-4000-8000-000000000015', 'member-lifecycle@example.invalid', now(), now());

insert into public.enterprise_memberships
  (id, tenant_id, user_id, status, display_name)
values
  ('31000000-0000-4000-8000-000000000105', '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000015', 'active', 'Former member');

insert into public.tasks
  (id, enterprise_id, title, status, assignee_id, assignee_name, completed)
values
  ('31000000-0000-4000-8000-000000000403', '31000000-0000-4000-8000-000000000001', 'Historical assigned task', 'pending', '31000000-0000-4000-8000-000000000015', 'Former member', false);

insert into public.notifications
  (id, enterprise_id, task_id, recipient_id, type, title)
values
  ('31000000-0000-4000-8000-000000000504', '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000403', '31000000-0000-4000-8000-000000000015', 'assignment', 'Historical assignment');

select lives_ok(
  $$
    delete from public.enterprise_memberships
    where id = '31000000-0000-4000-8000-000000000105'
  $$,
  'removing a member preserves referenced task and notification history'
);

select results_eq(
  $$
    select assignee_id, assignee_name
    from public.tasks
    where id = '31000000-0000-4000-8000-000000000403'
  $$,
  $$values (null::uuid, 'Former member'::text)$$,
  'member removal clears only the task identity while preserving its historical display name'
);

select results_eq(
  $$
    select recipient_id, title
    from public.notifications
    where id = '31000000-0000-4000-8000-000000000504'
  $$,
  $$values (null::uuid, 'Historical assignment'::text)$$,
  'member removal clears only the notification recipient while preserving the record'
);

select * from finish();

rollback;
