-- Prevent catalog-only permissions from deleting task data through a cascade.
alter table public.tasks
  drop constraint tasks_enterprise_id_category_id_fkey;

alter table public.tasks
  add constraint tasks_category_enterprise_fk
  foreign key (enterprise_id, category_id)
  references public.categories (enterprise_id, id)
  on delete restrict
  not valid;

-- The previous foreign key already guaranteed that existing task references
-- were valid, so changing only its delete action is safe to validate in place.
alter table public.tasks
  validate constraint tasks_category_enterprise_fk;

-- NOT VALID protects all new writes without rewriting or deleting legacy rows.
-- A clean database validates immediately; an upgrade containing inconsistent
-- legacy rows keeps the constraint unvalidated for a later audited repair.
alter table public.tasks
  add constraint tasks_completed_status_consistency
  check (completed = (status = 'completed'))
  not valid;

do $$
begin
  if not exists (
    select 1
    from public.tasks task_row
    where task_row.completed is distinct from (task_row.status = 'completed')
  ) then
    alter table public.tasks
      validate constraint tasks_completed_status_consistency;
  end if;
end;
$$;

-- A normal foreign key cannot express membership.status = 'active'. The
-- task RPCs below enforce active status while this NOT VALID relationship
-- blocks new cross-enterprise assignee ids without touching legacy rows.
alter table public.tasks
  add constraint tasks_assignee_membership_fk
  foreign key (enterprise_id, assignee_id)
  references public.enterprise_memberships (tenant_id, user_id)
  on delete set null (assignee_id)
  not valid;

do $$
begin
  if not exists (
    select 1
    from public.tasks task_row
    left join public.enterprise_memberships membership
      on membership.tenant_id = task_row.enterprise_id
     and membership.user_id = task_row.assignee_id
    where task_row.assignee_id is not null
      and membership.id is null
  ) then
    alter table public.tasks
      validate constraint tasks_assignee_membership_fk;
  end if;
end;
$$;

-- The same composite relationship prevents new cross-enterprise recipients;
-- guarded RPCs separately require active status. Existing invalid recipients
-- are preserved for an explicit production-data remediation.
alter table public.notifications
  add constraint notifications_recipient_membership_fk
  foreign key (enterprise_id, recipient_id)
  references public.enterprise_memberships (tenant_id, user_id)
  on delete set null (recipient_id)
  not valid;

do $$
begin
  if not exists (
    select 1
    from public.notifications notification
    left join public.enterprise_memberships membership
      on membership.tenant_id = notification.enterprise_id
     and membership.user_id = notification.recipient_id
    where notification.recipient_id is not null
      and membership.id is null
  ) then
    alter table public.notifications
      validate constraint notifications_recipient_membership_fk;
  end if;
end;
$$;

drop policy if exists notifications_select on public.notifications;

create policy notifications_select on public.notifications
for select to authenticated
using (
  (
    recipient_id = (select auth.uid())
    and app_private.has_permission(enterprise_id, 'notifications.read')
  )
  or app_private.has_enterprise_permission(enterprise_id, 'notifications.manage')
);

-- Direct UPDATE would allow changing recipient, enterprise, or message fields.
-- Only the read-state RPCs below may update notifications for ordinary callers.
drop policy if exists notifications_update on public.notifications;
revoke insert, update on table public.notifications from authenticated;

-- Assignment notifications are part of the task write transaction, so table
-- writes are not exposed as a second, non-atomic path.
revoke insert, update on table public.tasks from authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'v2_function_owner') then
    execute 'alter group v2_function_owner add user postgres';
  end if;
end;
$$;

grant usage, create on schema public to v2_function_owner;
grant select on table public.enterprise_memberships, public.categories to v2_function_owner;
grant select, insert, update on table public.tasks to v2_function_owner;
grant select, insert, update on table public.notifications to v2_function_owner;

create function public.mark_notification_read(
  target_enterprise_id uuid,
  target_notification_id uuid
)
returns public.notifications
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  updated_notification public.notifications%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'IDENTITY_REQUIRED';
  end if;

  if target_enterprise_id is null or target_notification_id is null then
    raise exception using errcode = '22023', message = 'INVALID_NOTIFICATION_TARGET';
  end if;

  if not app_private.has_permission(target_enterprise_id, 'notifications.read') then
    raise exception using errcode = '42501', message = 'NOTIFICATION_READ_FORBIDDEN';
  end if;

  update public.notifications notification
  set read = true,
      updated_at = clock_timestamp()
  where notification.enterprise_id = target_enterprise_id
    and notification.id = target_notification_id
    and notification.recipient_id = actor_id
  returning notification.* into updated_notification;

  if not found then
    raise exception using errcode = 'P0002', message = 'NOTIFICATION_NOT_FOUND';
  end if;

  return updated_notification;
end;
$$;

create function public.mark_all_notifications_read(
  target_enterprise_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  updated_count bigint;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'IDENTITY_REQUIRED';
  end if;

  if target_enterprise_id is null then
    raise exception using errcode = '22023', message = 'INVALID_ENTERPRISE';
  end if;

  if not app_private.has_permission(target_enterprise_id, 'notifications.read') then
    raise exception using errcode = '42501', message = 'NOTIFICATION_READ_FORBIDDEN';
  end if;

  update public.notifications notification
  set read = true,
      updated_at = clock_timestamp()
  where notification.enterprise_id = target_enterprise_id
    and notification.recipient_id = actor_id
    and notification.read = false;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

create function public.toggle_task(
  target_enterprise_id uuid,
  target_task_id uuid,
  expected_completed boolean
)
returns public.tasks
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  updated_task public.tasks%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '28000', message = 'IDENTITY_REQUIRED';
  end if;

  if target_enterprise_id is null
    or target_task_id is null
    or expected_completed is null then
    raise exception using errcode = '22023', message = 'INVALID_TASK_TOGGLE';
  end if;

  if not app_private.has_enterprise_permission(target_enterprise_id, 'tasks.manage') then
    raise exception using errcode = '42501', message = 'TASK_MANAGE_FORBIDDEN';
  end if;

  update public.tasks task_row
  set completed = not expected_completed,
      status = case when expected_completed then 'pending' else 'completed' end,
      updated_at = clock_timestamp()
  where task_row.enterprise_id = target_enterprise_id
    and task_row.id = target_task_id
    and task_row.completed = expected_completed
  returning task_row.* into updated_task;

  if not found then
    if exists (
      select 1
      from public.tasks task_row
      where task_row.enterprise_id = target_enterprise_id
        and task_row.id = target_task_id
    ) then
      raise exception using errcode = 'P0001', message = 'TASK_STATE_CONFLICT';
    end if;

    raise exception using errcode = 'P0002', message = 'TASK_NOT_FOUND';
  end if;

  return updated_task;
end;
$$;

create function public.create_task_notification(
  target_enterprise_id uuid,
  target_task_id uuid,
  target_recipient_id uuid,
  target_type text,
  target_title text,
  target_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  task_assignee_id uuid;
  task_event_at timestamptz;
  notification_time timestamptz;
  existing_notification public.notifications%rowtype;
  created_notification public.notifications%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'IDENTITY_REQUIRED';
  end if;

  if target_enterprise_id is null
    or target_task_id is null
    or target_recipient_id is null
    or target_type not in ('assignment', 'due_soon', 'overdue')
    or nullif(btrim(target_title), '') is null
    or char_length(target_title) > 200
    or char_length(target_message) > 2000 then
    raise exception using errcode = '22023', message = 'INVALID_TASK_NOTIFICATION';
  end if;

  if not (
    app_private.has_enterprise_permission(target_enterprise_id, 'tasks.manage')
    or app_private.has_enterprise_permission(target_enterprise_id, 'notifications.manage')
  ) then
    raise exception using errcode = '42501', message = 'TASK_NOTIFICATION_FORBIDDEN';
  end if;

  if not exists (
    select 1
    from public.enterprise_memberships membership
    where membership.tenant_id = target_enterprise_id
      and membership.user_id = target_recipient_id
      and membership.status = 'active'
  ) then
    raise exception using errcode = 'P0002', message = 'ACTIVE_ASSIGNEE_NOT_FOUND';
  end if;

  select task_row.assignee_id, task_row.updated_at
    into task_assignee_id, task_event_at
  from public.tasks task_row
  where task_row.enterprise_id = target_enterprise_id
    and task_row.id = target_task_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'TASK_NOT_FOUND';
  end if;

  if target_type = 'assignment' and task_assignee_id is distinct from target_recipient_id then
    raise exception using errcode = 'P0002', message = 'ASSIGNED_TASK_NOT_FOUND';
  end if;

  if target_type in ('due_soon', 'overdue')
    and task_assignee_id is not null
    and task_assignee_id is distinct from target_recipient_id then
    raise exception using errcode = 'P0002', message = 'TASK_RECIPIENT_MISMATCH';
  end if;

  if target_type in ('due_soon', 'overdue')
    and task_assignee_id is null
    and target_recipient_id is distinct from actor_id then
    raise exception using errcode = 'P0002', message = 'TASK_RECIPIENT_MISMATCH';
  end if;

  -- Serialize the absent-row case as well as retries without deleting or
  -- rewriting any existing notification data. The type participates in the
  -- key so assignment, due-soon, and overdue notifications remain distinct.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_enterprise_id::text || ':' || target_task_id::text || ':'
        || target_recipient_id::text || ':' || target_type || ':'
        || case
          when target_type = 'assignment' then task_event_at::text
          else 'task-lifetime'
        end,
      0
    )
  );

  select notification.* into existing_notification
  from public.notifications notification
  where notification.enterprise_id = target_enterprise_id
    and notification.task_id = target_task_id
    and notification.recipient_id = target_recipient_id
    and notification.type = target_type
    and (
      target_type <> 'assignment'
      or notification.created_at >= task_event_at
    )
  order by notification.created_at, notification.id
  limit 1;

  if found then
    return pg_catalog.jsonb_build_object(
      'notification', to_jsonb(existing_notification),
      'created', false
    );
  end if;

  notification_time := clock_timestamp();

  insert into public.notifications (
    enterprise_id,
    task_id,
    recipient_id,
    type,
    title,
    message,
    created_at,
    updated_at
  ) values (
    target_enterprise_id,
    target_task_id,
    target_recipient_id,
    target_type,
    btrim(target_title),
    target_message,
    notification_time,
    notification_time
  )
  returning * into created_notification;

  return pg_catalog.jsonb_build_object(
    'notification', to_jsonb(created_notification),
    'created', true
  );
end;
$$;

create function public.create_task_with_notification(
  target_enterprise_id uuid,
  task_fields jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  created_task public.tasks%rowtype;
  assignee_display_name text;
  notification_result jsonb;
  task_status text;
  task_priority integer;
  task_category_id uuid;
  task_assignee_id uuid;
  task_assignee_name text;
  task_due_date timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '28000', message = 'IDENTITY_REQUIRED';
  end if;

  if target_enterprise_id is null
    or task_fields is null
    or pg_catalog.jsonb_typeof(task_fields) <> 'object'
    or task_fields - array[
      'title', 'description', 'status', 'priority', 'category_id',
      'assignee_id', 'assignee_name', 'due_date'
    ]::text[] <> '{}'::jsonb
    or nullif(btrim(task_fields ->> 'title'), '') is null
    or char_length(task_fields ->> 'title') > 200
    or char_length(task_fields ->> 'description') > 2000
    or char_length(task_fields ->> 'assignee_name') > 100 then
    raise exception using errcode = '22023', message = 'INVALID_TASK_FIELDS';
  end if;

  if not app_private.has_enterprise_permission(target_enterprise_id, 'tasks.manage') then
    raise exception using errcode = '42501', message = 'TASK_MANAGE_FORBIDDEN';
  end if;

  task_status := coalesce(task_fields ->> 'status', 'pending');
  task_priority := coalesce((task_fields ->> 'priority')::integer, 0);
  task_category_id := nullif(task_fields ->> 'category_id', '')::uuid;
  task_assignee_id := nullif(task_fields ->> 'assignee_id', '')::uuid;
  task_assignee_name := nullif(btrim(task_fields ->> 'assignee_name'), '');
  task_due_date := nullif(task_fields ->> 'due_date', '')::timestamptz;

  if task_status not in ('pending', 'in_progress', 'completed', 'cancelled')
    or task_priority not between 0 and 3 then
    raise exception using errcode = '22023', message = 'INVALID_TASK_FIELDS';
  end if;

  if task_category_id is not null and not exists (
    select 1
    from public.categories category
    where category.enterprise_id = target_enterprise_id
      and category.id = task_category_id
  ) then
    raise exception using errcode = 'P0002', message = 'CATEGORY_NOT_FOUND';
  end if;

  if task_assignee_id is not null then
    select membership.display_name into assignee_display_name
    from public.enterprise_memberships membership
    where membership.tenant_id = target_enterprise_id
      and membership.user_id = task_assignee_id
      and membership.status = 'active';

    if not found then
      raise exception using errcode = 'P0002', message = 'ACTIVE_ASSIGNEE_NOT_FOUND';
    end if;

    task_assignee_name := assignee_display_name;
  end if;

  insert into public.tasks (
    enterprise_id,
    title,
    description,
    status,
    priority,
    category_id,
    assignee_id,
    assignee_name,
    due_date,
    completed
  ) values (
    target_enterprise_id,
    btrim(task_fields ->> 'title'),
    task_fields ->> 'description',
    task_status,
    task_priority,
    task_category_id,
    task_assignee_id,
    task_assignee_name,
    task_due_date,
    task_status = 'completed'
  )
  returning * into created_task;

  if task_assignee_id is not null then
    notification_result := public.create_task_notification(
      target_enterprise_id,
      created_task.id,
      task_assignee_id,
      'assignment',
      '新任务分配: ' || created_task.title,
      '您被分配了任务“' || created_task.title || '”'
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'task', to_jsonb(created_task),
    'notification', notification_result -> 'notification'
  );
end;
$$;

create function public.update_task_with_notification(
  target_enterprise_id uuid,
  target_task_id uuid,
  task_fields jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  current_task public.tasks%rowtype;
  updated_task public.tasks%rowtype;
  notification_result jsonb;
  next_status text;
  next_priority integer;
  next_category_id uuid;
  next_assignee_id uuid;
  next_assignee_name text;
  next_due_date timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '28000', message = 'IDENTITY_REQUIRED';
  end if;

  if target_enterprise_id is null
    or target_task_id is null
    or task_fields is null
    or pg_catalog.jsonb_typeof(task_fields) <> 'object'
    or task_fields = '{}'::jsonb
    or task_fields - array[
      'title', 'description', 'status', 'priority', 'category_id',
      'assignee_id', 'assignee_name', 'due_date'
    ]::text[] <> '{}'::jsonb
    or (task_fields ? 'title' and (
      nullif(btrim(task_fields ->> 'title'), '') is null
      or char_length(task_fields ->> 'title') > 200
    ))
    or char_length(task_fields ->> 'description') > 2000
    or char_length(task_fields ->> 'assignee_name') > 100 then
    raise exception using errcode = '22023', message = 'INVALID_TASK_FIELDS';
  end if;

  if not app_private.has_enterprise_permission(target_enterprise_id, 'tasks.manage') then
    raise exception using errcode = '42501', message = 'TASK_MANAGE_FORBIDDEN';
  end if;

  select task_row.* into current_task
  from public.tasks task_row
  where task_row.enterprise_id = target_enterprise_id
    and task_row.id = target_task_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'TASK_NOT_FOUND';
  end if;

  next_status := case when task_fields ? 'status' then task_fields ->> 'status' else current_task.status end;
  next_priority := case when task_fields ? 'priority' then (task_fields ->> 'priority')::integer else current_task.priority end;
  next_category_id := case when task_fields ? 'category_id' then nullif(task_fields ->> 'category_id', '')::uuid else current_task.category_id end;
  next_assignee_id := case when task_fields ? 'assignee_id' then nullif(task_fields ->> 'assignee_id', '')::uuid else current_task.assignee_id end;
  next_due_date := case when task_fields ? 'due_date' then nullif(task_fields ->> 'due_date', '')::timestamptz else current_task.due_date end;

  if next_status not in ('pending', 'in_progress', 'completed', 'cancelled')
    or next_priority not between 0 and 3 then
    raise exception using errcode = '22023', message = 'INVALID_TASK_FIELDS';
  end if;

  if next_category_id is not null and not exists (
    select 1
    from public.categories category
    where category.enterprise_id = target_enterprise_id
      and category.id = next_category_id
  ) then
    raise exception using errcode = 'P0002', message = 'CATEGORY_NOT_FOUND';
  end if;

  if task_fields ? 'assignee_id' then
    if next_assignee_id is null then
      next_assignee_name := case
        when task_fields ? 'assignee_name'
          then nullif(btrim(task_fields ->> 'assignee_name'), '')
        else null
      end;
    else
      select membership.display_name into next_assignee_name
      from public.enterprise_memberships membership
      where membership.tenant_id = target_enterprise_id
        and membership.user_id = next_assignee_id
        and membership.status = 'active';

      if not found then
        raise exception using errcode = 'P0002', message = 'ACTIVE_ASSIGNEE_NOT_FOUND';
      end if;
    end if;
  else
    next_assignee_name := case
      when current_task.assignee_id is not null then current_task.assignee_name
      when task_fields ? 'assignee_name' then nullif(btrim(task_fields ->> 'assignee_name'), '')
      else current_task.assignee_name
    end;
  end if;

  update public.tasks task_row
  set title = case when task_fields ? 'title' then btrim(task_fields ->> 'title') else current_task.title end,
      description = case when task_fields ? 'description' then task_fields ->> 'description' else current_task.description end,
      status = next_status,
      priority = next_priority,
      category_id = next_category_id,
      assignee_id = next_assignee_id,
      assignee_name = next_assignee_name,
      due_date = next_due_date,
      completed = next_status = 'completed',
      updated_at = clock_timestamp()
  where task_row.enterprise_id = target_enterprise_id
    and task_row.id = target_task_id
  returning task_row.* into updated_task;

  if next_assignee_id is not null
    and next_assignee_id is distinct from current_task.assignee_id then
    notification_result := public.create_task_notification(
      target_enterprise_id,
      updated_task.id,
      next_assignee_id,
      'assignment',
      '新任务分配: ' || updated_task.title,
      '您被分配了任务“' || updated_task.title || '”'
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'task', to_jsonb(updated_task),
    'notification', notification_result -> 'notification'
  );
end;
$$;

alter function public.mark_notification_read(uuid, uuid)
  owner to v2_function_owner;
alter function public.mark_all_notifications_read(uuid)
  owner to v2_function_owner;
alter function public.toggle_task(uuid, uuid, boolean)
  owner to v2_function_owner;
alter function public.create_task_notification(uuid, uuid, uuid, text, text, text)
  owner to v2_function_owner;
alter function public.create_task_with_notification(uuid, jsonb)
  owner to v2_function_owner;
alter function public.update_task_with_notification(uuid, uuid, jsonb)
  owner to v2_function_owner;

revoke all on function public.mark_notification_read(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.mark_all_notifications_read(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.toggle_task(uuid, uuid, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.create_task_notification(uuid, uuid, uuid, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.create_task_with_notification(uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.update_task_with_notification(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;

grant execute on function public.mark_notification_read(uuid, uuid)
  to authenticated;
grant execute on function public.mark_all_notifications_read(uuid)
  to authenticated;
grant execute on function public.toggle_task(uuid, uuid, boolean)
  to authenticated;
grant execute on function public.create_task_notification(uuid, uuid, uuid, text, text, text)
  to authenticated;
grant execute on function public.create_task_with_notification(uuid, jsonb)
  to authenticated;
grant execute on function public.update_task_with_notification(uuid, uuid, jsonb)
  to authenticated;

revoke create on schema public from v2_function_owner;

do $$
begin
  if exists (
    select 1
    from pg_auth_members membership
    join pg_roles role on role.oid = membership.roleid
    join pg_roles member on member.oid = membership.member
    where role.rolname = 'v2_function_owner'
      and member.rolname = 'postgres'
  ) then
    execute 'alter group v2_function_owner drop user postgres';
  end if;
end;
$$;
