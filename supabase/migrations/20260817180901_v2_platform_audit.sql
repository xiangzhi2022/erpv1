do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'v2_security_retention_owner'
  ) then
    create role v2_security_retention_owner;
  end if;
end;
$$;

alter role v2_security_retention_owner
  with nologin noinherit nobypassrls;

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_auth_members membership
    where membership.roleid = 'v2_function_owner'::regrole
      and membership.member = 'postgres'::regrole
  ) then
    execute 'alter group v2_function_owner drop user postgres';
  end if;
  if exists (
    select 1
    from pg_catalog.pg_auth_members membership
    where membership.roleid = 'v2_security_retention_owner'::regrole
      and membership.member = 'postgres'::regrole
  ) then
    execute 'alter group v2_security_retention_owner drop user postgres';
  end if;
end;
$$;

alter group v2_function_owner add user postgres;

alter group v2_security_retention_owner add user postgres;

grant usage, create on schema app_private
  to v2_security_retention_owner;

grant create on schema public to v2_function_owner;

alter table public.enterprise_memberships
  add constraint enterprise_memberships_tenant_id_id_user_id_key
  unique (tenant_id, id, user_id);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  membership_id uuid not null,
  actor_id uuid not null,
  action text not null,
  resource_type text not null,
  resource_id uuid not null,
  outcome text not null,
  correlation_id uuid not null,
  metadata jsonb not null,
  metadata_trusted boolean not null,
  ip_hash text,
  user_agent_summary text,
  occurred_at timestamptz not null default now(),
  constraint audit_events_tenant_id_fkey
    foreign key (tenant_id)
    references public.enterprises(id),
  constraint audit_events_membership_actor_fkey
    foreign key (tenant_id, membership_id, actor_id)
    references public.enterprise_memberships(tenant_id, id, user_id),
  constraint audit_events_action_check
    check (action = 'enterprise.context.selection_authorized'),
  constraint audit_events_resource_check
    check (
      resource_type = 'enterprise'
      and resource_id = tenant_id
    ),
  constraint audit_events_outcome_check
    check (outcome = 'allowed'),
  constraint audit_events_metadata_check
    check (
      pg_catalog.jsonb_typeof(metadata) = 'object'
      and pg_catalog.jsonb_typeof(metadata -> 'method') = 'string'
      and pg_catalog.jsonb_typeof(metadata -> 'path') = 'string'
      and metadata = pg_catalog.jsonb_build_object(
        'method', metadata ->> 'method',
        'path', metadata ->> 'path'
      )
      and metadata ->> 'method' ~ '^[A-Z]{1,16}$'
      and pg_catalog.octet_length(metadata ->> 'path') between 1 and 1024
      and metadata ->> 'path' like '/%'
      and metadata ->> 'path' !~ '[?#[:cntrl:]]'
    ),
  constraint audit_events_metadata_trusted_check
    check (
      (not metadata_trusted and ip_hash is null)
      or (
        metadata_trusted
        and ip_hash ~ '^[0-9a-f]{64}$'
      )
    ),
  constraint audit_events_user_agent_check
    check (
      user_agent_summary is null
      or (
        pg_catalog.octet_length(user_agent_summary) between 1 and 256
        and user_agent_summary !~ '[[:cntrl:]]'
        and user_agent_summary !~* '(authorization|cookie|password|bearer[[:space:]]|token=)'
      )
    )
);

create index audit_events_tenant_occurred_at_idx
  on public.audit_events (tenant_id, occurred_at desc, id);

create index audit_events_actor_occurred_at_idx
  on public.audit_events (actor_id, occurred_at desc, id);

create index audit_events_membership_id_idx
  on public.audit_events (tenant_id, membership_id);

create table public.identity_action_requests (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  action text not null,
  idempotency_key uuid not null,
  target_hash text not null,
  state text not null,
  result jsonb,
  correlation_id uuid not null,
  locked_until timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identity_action_requests_actor_action_key_key
    unique (actor_id, action, idempotency_key),
  constraint identity_action_requests_action_check
    check (action = 'enterprise.context.select'),
  constraint identity_action_requests_target_hash_check
    check (target_hash ~ '^[0-9a-f]{64}$'),
  constraint identity_action_requests_state_check
    check (state in ('processing', 'completed')),
  constraint identity_action_requests_time_bounds_check
    check (
      locked_until > updated_at
      and locked_until <= updated_at + interval '5 minutes'
      and expires_at > locked_until
      and expires_at <= updated_at + interval '1 day'
    ),
  constraint identity_action_requests_result_check
    check (
      (state = 'processing' and result is null)
      or (
        state = 'completed'
        and pg_catalog.jsonb_typeof(result) = 'object'
        and (
          result = '{"allowed": false}'::jsonb
          or (
            result = pg_catalog.jsonb_build_object(
              'allowed', true,
              'tenantId', result ->> 'tenantId',
              'membershipId', result ->> 'membershipId'
            )
            and result ->> 'tenantId'
              ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            and result ->> 'membershipId'
              ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            and target_hash = pg_catalog.encode(
              pg_catalog.sha256(
                pg_catalog.convert_to(result ->> 'tenantId', 'UTF8')
              ),
              'hex'
            )
          )
        )
      )
    )
);

create index identity_action_requests_expires_at_idx
  on public.identity_action_requests (expires_at, id);

create index identity_action_requests_actor_created_at_idx
  on public.identity_action_requests (actor_id, created_at desc, id);

create table app_private.security_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  event_code text not null,
  attempted_target_hash text not null,
  correlation_id uuid not null,
  identity_action_request_id uuid not null unique,
  occurred_at timestamptz not null,
  expires_at timestamptz not null,
  constraint security_events_identity_action_request_id_fkey
    foreign key (identity_action_request_id)
    references public.identity_action_requests(id),
  constraint security_events_event_code_check
    check (event_code = 'enterprise.context.selection_denied'),
  constraint security_events_attempted_target_hash_check
    check (attempted_target_hash ~ '^[0-9a-f]{64}$'),
  constraint security_events_retention_check
    check (expires_at = occurred_at + interval '90 days')
);

create index security_events_expires_at_id_idx
  on app_private.security_events (expires_at, id);

create index security_events_actor_occurred_at_idx
  on app_private.security_events (actor_id, occurred_at desc, id);

alter table public.audit_events owner to v2_function_owner;

alter table public.identity_action_requests owner to v2_function_owner;

alter table app_private.security_events owner to v2_function_owner;

alter table public.audit_events enable row level security;

alter table public.audit_events force row level security;

alter table public.identity_action_requests enable row level security;

alter table public.identity_action_requests force row level security;

alter table app_private.security_events enable row level security;

alter table app_private.security_events force row level security;

revoke all on table public.audit_events
  from public, anon, authenticated, service_role, postgres,
    v2_security_retention_owner;

revoke all on table public.identity_action_requests
  from public, anon, authenticated, service_role, postgres,
    v2_security_retention_owner;

revoke all on table app_private.security_events
  from public, anon, authenticated, service_role, postgres,
    v2_security_retention_owner;

grant select on table public.audit_events to authenticated;

grant select, delete on table app_private.security_events
  to v2_security_retention_owner;

grant update (id) on table app_private.security_events
  to v2_security_retention_owner;

create policy audit_events_select_enterprise_auditors
on public.audit_events
for select
to authenticated
using (
  app_private.has_enterprise_permission(tenant_id, 'audit.read')
);

create policy security_events_select_expired_for_retention
on app_private.security_events
for select
to v2_security_retention_owner
using (expires_at <= pg_catalog.clock_timestamp());

create policy security_events_delete_expired_for_retention
on app_private.security_events
for delete
to v2_security_retention_owner
using (expires_at <= pg_catalog.clock_timestamp());

create policy security_events_lock_expired_for_retention
on app_private.security_events
for update
to v2_security_retention_owner
using (expires_at <= pg_catalog.clock_timestamp())
with check (false);

create function app_private.reject_audit_event_mutation()
returns trigger
language plpgsql
volatile
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception using
    errcode = 'P0001',
    message = 'audit events are immutable';
end;
$$;

create trigger audit_events_reject_mutation
before update or delete on public.audit_events
for each row
execute function app_private.reject_audit_event_mutation();

create function app_private.guard_security_event_mutation()
returns trigger
language plpgsql
volatile
security invoker
set search_path = pg_catalog
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception using
      errcode = 'P0001',
      message = 'security events cannot be updated';
  end if;

  if current_user <> 'v2_security_retention_owner' then
    raise exception using
      errcode = 'P0001',
      message = 'security events may only be deleted by retention';
  end if;

  if old.expires_at > pg_catalog.clock_timestamp() then
    raise exception using
      errcode = 'P0001',
      message = 'security event is not expired';
  end if;

  return old;
end;
$$;

create trigger security_events_guard_mutation
before update or delete on app_private.security_events
for each row
execute function app_private.guard_security_event_mutation();

create function app_private.write_audit_event(
  target_tenant_id uuid,
  event_action text,
  event_resource_type text,
  event_resource_id uuid,
  event_outcome text,
  event_correlation_id uuid,
  trusted_ip_hash text,
  request_method text,
  request_path text,
  user_agent_summary text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  current_actor_id uuid;
  active_membership_id uuid;
  audit_event_id uuid;
  is_metadata_trusted boolean;
begin
  current_actor_id := app_private.current_actor_id();

  if current_actor_id is null
    or target_tenant_id is null
    or event_action <> 'enterprise.context.selection_authorized'
    or event_resource_type <> 'enterprise'
    or event_resource_id is distinct from target_tenant_id
    or event_outcome <> 'allowed'
    or event_correlation_id is null
    or request_method is null
    or request_method !~ '^[A-Z]{1,16}$'
    or request_path is null
    or pg_catalog.octet_length(request_path) not between 1 and 1024
    or request_path not like '/%'
    or request_path ~ '[?#[:cntrl:]]'
    or (
      trusted_ip_hash is not null
      and trusted_ip_hash !~ '^[0-9a-f]{64}$'
    )
    or (
      user_agent_summary is not null
      and (
        pg_catalog.octet_length(user_agent_summary) not between 1 and 256
        or user_agent_summary ~ '[[:cntrl:]]'
        or user_agent_summary
          ~* '(authorization|cookie|password|bearer[[:space:]]|token=)'
      )
    )
  then
    raise exception using
      errcode = '22023',
      message = 'invalid audit event input';
  end if;

  select membership.id
  into active_membership_id
  from public.enterprise_memberships membership
  join public.enterprises enterprise on enterprise.id = membership.tenant_id
  where membership.tenant_id = target_tenant_id
    and membership.user_id = current_actor_id
    and membership.status = 'active'
    and enterprise.status = 'active';

  if active_membership_id is null then
    raise exception using
      errcode = '42501',
      message = 'active enterprise membership required';
  end if;

  is_metadata_trusted := trusted_ip_hash is not null;

  insert into public.audit_events (
    tenant_id,
    membership_id,
    actor_id,
    action,
    resource_type,
    resource_id,
    outcome,
    correlation_id,
    metadata,
    metadata_trusted,
    ip_hash,
    user_agent_summary
  )
  values (
    target_tenant_id,
    active_membership_id,
    current_actor_id,
    event_action,
    event_resource_type,
    event_resource_id,
    event_outcome,
    event_correlation_id,
    pg_catalog.jsonb_build_object(
      'method', request_method,
      'path', request_path
    ),
    is_metadata_trusted,
    trusted_ip_hash,
    user_agent_summary
  )
  returning id into audit_event_id;

  return audit_event_id;
end;
$$;

create function app_private.authorize_enterprise_selection(
  target_enterprise_id uuid,
  target_idempotency_key uuid,
  target_correlation_id uuid,
  caller_user_agent text
)
returns table (
  allowed boolean,
  tenant_id uuid,
  membership_id uuid
)
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  current_actor_id uuid;
  attempted_target_hash text;
  request_time timestamptz;
  request_id uuid;
  stored_target_hash text;
  stored_state text;
  stored_result jsonb;
  stored_locked_until timestamptz;
  stored_expires_at timestamptz;
  validated_membership_id uuid;
  completed_result jsonb;
  bounded_user_agent text;
  coarse_user_agent text;
  security_event_id uuid;
begin
  current_actor_id := app_private.current_actor_id();

  if current_actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'authenticated identity required';
  end if;

  if target_enterprise_id is null
    or target_idempotency_key is null
    or target_correlation_id is null
  then
    raise exception using
      errcode = '22023',
      message = 'invalid enterprise selection input';
  end if;

  bounded_user_agent := pg_catalog.left(caller_user_agent, 256);
  coarse_user_agent := case
    when bounded_user_agent is null
      or pg_catalog.btrim(bounded_user_agent) = ''
      then null
    when bounded_user_agent ~* '(Mobile|Android|iPhone|iPad)'
      then 'Mobile'
    when bounded_user_agent ~* '(Edg|Edge)/'
      then 'Edge'
    when bounded_user_agent ~* '(Firefox|FxiOS)/'
      then 'Firefox'
    when bounded_user_agent ~* '(Chrome|CriOS)/'
      then 'Chrome'
    when bounded_user_agent ~* 'Safari/'
      then 'Safari'
    else 'Other'
  end;

  request_time := pg_catalog.clock_timestamp();
  attempted_target_hash := pg_catalog.encode(
    pg_catalog.sha256(
      pg_catalog.convert_to(target_enterprise_id::text, 'UTF8')
    ),
    'hex'
  );

  insert into public.identity_action_requests (
    actor_id,
    action,
    idempotency_key,
    target_hash,
    state,
    result,
    correlation_id,
    locked_until,
    expires_at,
    created_at,
    updated_at
  )
  values (
    current_actor_id,
    'enterprise.context.select',
    target_idempotency_key,
    attempted_target_hash,
    'processing',
    null,
    target_correlation_id,
    request_time + interval '5 minutes',
    request_time + interval '1 day',
    request_time,
    request_time
  )
  on conflict (actor_id, action, idempotency_key) do nothing
  returning id into request_id;

  if request_id is null then
    select
      request_row.id,
      request_row.target_hash,
      request_row.state,
      request_row.result,
      request_row.locked_until,
      request_row.expires_at
    into
      request_id,
      stored_target_hash,
      stored_state,
      stored_result,
      stored_locked_until,
      stored_expires_at
    from public.identity_action_requests request_row
    where request_row.actor_id = current_actor_id
      and request_row.action = 'enterprise.context.select'
      and request_row.idempotency_key = target_idempotency_key
    for update;

    request_time := pg_catalog.clock_timestamp();

    if stored_target_hash <> attempted_target_hash then
      raise exception using
        errcode = 'P0001',
        message = 'idempotency_key_reused';
    elsif stored_state = 'completed' then
      if stored_result ->> 'allowed' = 'true' then
        allowed := true;
        tenant_id := (stored_result ->> 'tenantId')::uuid;
        membership_id := (stored_result ->> 'membershipId')::uuid;
      else
        allowed := false;
        tenant_id := null;
        membership_id := null;
      end if;
      return next;
      return;
    elsif stored_expires_at <= request_time
      or stored_locked_until <= request_time
    then
      update public.identity_action_requests request_row
      set
        state = 'processing',
        result = null,
        correlation_id = target_correlation_id,
        locked_until = request_time + interval '5 minutes',
        expires_at = request_time + interval '1 day',
        updated_at = request_time
      where request_row.id = request_id;
    else
      raise exception using
        errcode = 'P0001',
        message = 'idempotency_in_progress';
    end if;
  end if;

  select membership.id
  into validated_membership_id
  from public.enterprise_memberships membership
  join public.enterprises enterprise on enterprise.id = membership.tenant_id
  where membership.tenant_id = target_enterprise_id
    and membership.user_id = current_actor_id
    and membership.status = 'active'
    and enterprise.status = 'active';

  request_time := pg_catalog.clock_timestamp();

  if validated_membership_id is not null then
    perform app_private.write_audit_event(
      target_enterprise_id,
      'enterprise.context.selection_authorized',
      'enterprise',
      target_enterprise_id,
      'allowed',
      target_correlation_id,
      null,
      'POST',
      '/api/v2/enterprise-context',
      coarse_user_agent
    );

    completed_result := pg_catalog.jsonb_build_object(
      'allowed', true,
      'tenantId', target_enterprise_id::text,
      'membershipId', validated_membership_id::text
    );
  else
    begin
      insert into app_private.security_events (
        actor_id,
        event_code,
        attempted_target_hash,
        correlation_id,
        identity_action_request_id,
        occurred_at,
        expires_at
      )
      values (
        current_actor_id,
        'enterprise.context.selection_denied',
        attempted_target_hash,
        target_correlation_id,
        request_id,
        request_time,
        request_time + interval '90 days'
      )
      returning id into security_event_id;
    exception
      when unique_violation then
        raise exception using
          errcode = 'P0001',
          message = 'security_event_conflict';
    end;

    if security_event_id is null then
      raise exception using
        errcode = 'P0001',
        message = 'security_event_conflict';
    end if;

    completed_result := '{"allowed": false}'::jsonb;
  end if;

  update public.identity_action_requests request_row
  set
    state = 'completed',
    result = completed_result,
    locked_until = request_time + interval '5 minutes',
    expires_at = request_time + interval '1 day',
    updated_at = request_time
  where request_row.id = request_id;

  if completed_result ->> 'allowed' = 'true' then
    allowed := true;
    tenant_id := target_enterprise_id;
    membership_id := validated_membership_id;
  else
    allowed := false;
    tenant_id := null;
    membership_id := null;
  end if;

  return next;
end;
$$;

create function public.authorize_enterprise_selection(
  target_enterprise_id uuid,
  target_idempotency_key uuid,
  target_correlation_id uuid,
  caller_user_agent text default null
)
returns table (
  allowed boolean,
  tenant_id uuid,
  membership_id uuid
)
language sql
volatile
security invoker
set search_path = pg_catalog
as $$
  select
    selection.allowed,
    selection.tenant_id,
    selection.membership_id
  from app_private.authorize_enterprise_selection(
    $1,
    $2,
    $3,
    $4
  ) selection;
$$;

create function app_private.cleanup_expired_security_events(
  batch_size integer default 1000
)
returns integer
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  deleted_count integer;
begin
  if batch_size is null or batch_size not between 1 and 1000 then
    raise exception using
      errcode = '22023',
      message = 'invalid security retention batch size';
  end if;

  with expired as (
    select security_event.id
    from app_private.security_events security_event
    where security_event.expires_at <= pg_catalog.clock_timestamp()
    order by security_event.expires_at, security_event.id
    limit batch_size
    for update skip locked
  )
  delete from app_private.security_events security_event
  using expired
  where security_event.id = expired.id;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

alter function app_private.reject_audit_event_mutation()
  owner to v2_function_owner;

alter function app_private.guard_security_event_mutation()
  owner to v2_function_owner;

alter function app_private.write_audit_event(
  uuid, text, text, uuid, text, uuid, text, text, text, text
) owner to v2_function_owner;

alter function app_private.authorize_enterprise_selection(
  uuid, uuid, uuid, text
) owner to v2_function_owner;

alter function public.authorize_enterprise_selection(
  uuid, uuid, uuid, text
) owner to v2_function_owner;

alter function app_private.cleanup_expired_security_events(integer)
  owner to v2_security_retention_owner;

revoke create on schema app_private from v2_security_retention_owner;

revoke create on schema public from v2_function_owner;

revoke all on function app_private.reject_audit_event_mutation()
  from public, anon, authenticated, service_role, postgres,
    v2_security_retention_owner;

revoke all on function app_private.guard_security_event_mutation()
  from public, anon, authenticated, service_role, postgres,
    v2_security_retention_owner;

revoke all on function app_private.write_audit_event(
  uuid, text, text, uuid, text, uuid, text, text, text, text
) from public, anon, authenticated, service_role, postgres,
    v2_security_retention_owner;

revoke all on function app_private.authorize_enterprise_selection(
  uuid, uuid, uuid, text
) from public, anon, authenticated, service_role, postgres,
    v2_security_retention_owner;

grant execute on function app_private.authorize_enterprise_selection(
  uuid, uuid, uuid, text
) to authenticated;

revoke all on function public.authorize_enterprise_selection(
  uuid, uuid, uuid, text
) from public, anon, authenticated, service_role, postgres,
    v2_security_retention_owner;

grant execute on function public.authorize_enterprise_selection(
  uuid, uuid, uuid, text
) to authenticated;

revoke all on function app_private.cleanup_expired_security_events(integer)
  from public, anon, authenticated, service_role, postgres,
    v2_function_owner;

alter group v2_function_owner drop user postgres;

alter group v2_security_retention_owner drop user postgres;
