do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'v2_maintenance_owner'
  ) then
    create role v2_maintenance_owner;
  end if;
end;
$$;

alter role v2_maintenance_owner with nologin noinherit bypassrls;

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
    where membership.roleid = 'v2_maintenance_owner'::regrole
      and membership.member = 'postgres'::regrole
  ) then
    execute 'alter group v2_maintenance_owner drop user postgres';
  end if;
end;
$$;

alter group v2_function_owner add user postgres;

alter group v2_maintenance_owner add user postgres;

create function app_private.idempotency_response_has_sensitive_fields(
  response_body jsonb
)
returns boolean
language sql
immutable
security invoker
set search_path = pg_catalog
as $$
  with recursive nodes(value) as (
    select $1
    union all
    select child.value
    from nodes parent
    cross join lateral (
      select object_child.value
      from pg_catalog.jsonb_each(
        case
          when pg_catalog.jsonb_typeof(parent.value) = 'object'
            then parent.value
          else '{}'::jsonb
        end
      ) object_child
      union all
      select array_child.value
      from pg_catalog.jsonb_array_elements(
        case
          when pg_catalog.jsonb_typeof(parent.value) = 'array'
            then parent.value
          else '[]'::jsonb
        end
      ) array_child
    ) child
  )
  select exists (
    select 1
    from nodes node
    cross join lateral pg_catalog.jsonb_object_keys(
      case
        when pg_catalog.jsonb_typeof(node.value) = 'object'
          then node.value
        else '{}'::jsonb
      end
    ) key_name
    cross join lateral (
      select normalize(key_name, NFKC) as value
    ) normalized_key
    where normalized_key.value !~ '^[A-Za-z0-9_-]+$'
      or pg_catalog.lower(normalized_key.value) = any (
      array[
        'authorization',
        'cookie',
        'set-cookie',
        'token',
        'access_token',
        'refresh_token',
        'password',
        'secret'
      ]::text[]
    )
  );
$$;

alter function app_private.idempotency_response_has_sensitive_fields(jsonb)
  owner to v2_function_owner;

revoke all on function app_private.idempotency_response_has_sensitive_fields(jsonb)
  from public, anon, authenticated, service_role, v2_maintenance_owner;

create table public.api_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  actor_id uuid not null,
  idempotency_key text not null,
  request_hash text not null,
  claim_token uuid not null,
  state text not null,
  locked_until timestamptz not null,
  response_status smallint,
  response_body jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint api_idempotency_keys_tenant_actor_key_key
    unique (tenant_id, actor_id, idempotency_key),
  constraint api_idempotency_keys_membership_fkey
    foreign key (tenant_id, actor_id)
    references public.enterprise_memberships(tenant_id, user_id)
    on delete cascade,
  constraint api_idempotency_keys_key_check
    check (
      idempotency_key = pg_catalog.btrim(idempotency_key)
      and pg_catalog.octet_length(idempotency_key) between 1 and 200
    ),
  constraint api_idempotency_keys_request_hash_check
    check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint api_idempotency_keys_state_check
    check (state in ('processing', 'completed')),
  constraint api_idempotency_keys_lease_check
    check (locked_until <= expires_at),
  constraint api_idempotency_keys_response_check
    check (
      (
        state = 'processing'
        and response_status is null
        and response_body is null
      )
      or (
        state = 'completed'
        and response_status between 200 and 599
        and response_body is not null
        and pg_catalog.jsonb_typeof(response_body) = 'object'
        and pg_catalog.octet_length(
          pg_catalog.convert_to(response_body::text, 'UTF8')
        ) <= 65536
        and not app_private.idempotency_response_has_sensitive_fields(
          response_body
        )
      )
    )
);

create index api_idempotency_keys_expires_at_idx
  on public.api_idempotency_keys (expires_at, id);

alter table public.api_idempotency_keys enable row level security;

alter table public.api_idempotency_keys force row level security;

revoke all on table public.api_idempotency_keys
  from public, anon, authenticated, service_role, v2_function_owner,
    v2_maintenance_owner;

grant select, insert, update on table public.api_idempotency_keys
  to v2_function_owner;

grant select, delete on table public.api_idempotency_keys
  to v2_maintenance_owner;

grant update (id) on table public.api_idempotency_keys
  to v2_maintenance_owner;

create function app_private.claim_idempotency(
  target_tenant_id uuid,
  target_actor_id uuid,
  target_idempotency_key text,
  target_request_hash text,
  target_lock_ttl interval default interval '5 minutes',
  target_retention interval default interval '1 day'
)
returns table (
  outcome text,
  response_status smallint,
  response_body jsonb,
  claim_token uuid
)
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  claim_time timestamptz;
  candidate_claim_token uuid;
  claim_attempt smallint;
  inserted_id uuid;
  stored_row_found boolean := false;
  stored_hash text;
  stored_state text;
  stored_locked_until timestamptz;
  stored_expires_at timestamptz;
  stored_response_status smallint;
  stored_response_body jsonb;
begin
  if target_tenant_id is null
    or target_actor_id is null
    or target_idempotency_key is null
    or target_idempotency_key <> pg_catalog.btrim(target_idempotency_key)
    or pg_catalog.octet_length(target_idempotency_key) not between 1 and 200
    or target_request_hash is null
    or target_request_hash !~ '^[0-9a-f]{64}$'
    or target_lock_ttl is null
    or target_lock_ttl <= interval '0 seconds'
    or target_lock_ttl > interval '15 minutes'
    or target_retention is null
    or target_retention <= target_lock_ttl
    or target_retention > interval '30 days'
  then
    raise exception using
      errcode = '22023',
      message = 'invalid idempotency claim input';
  end if;

  for claim_attempt in 1..2 loop
    claim_time := pg_catalog.clock_timestamp();
    candidate_claim_token := pg_catalog.gen_random_uuid();
    inserted_id := null;

    insert into public.api_idempotency_keys (
      tenant_id,
      actor_id,
      idempotency_key,
      request_hash,
      claim_token,
      state,
      locked_until,
      expires_at,
      created_at,
      updated_at
    )
    values (
      target_tenant_id,
      target_actor_id,
      target_idempotency_key,
      target_request_hash,
      candidate_claim_token,
      'processing',
      claim_time + target_lock_ttl,
      claim_time + target_retention,
      claim_time,
      claim_time
    )
    on conflict (tenant_id, actor_id, idempotency_key) do nothing
    returning id into inserted_id;

    if inserted_id is not null then
      claim_time := pg_catalog.clock_timestamp();
      update public.api_idempotency_keys key_row
      set
        locked_until = claim_time + target_lock_ttl,
        expires_at = claim_time + target_retention,
        updated_at = claim_time
      where key_row.id = inserted_id;

      return query
        select 'claimed'::text, null::smallint, null::jsonb,
          candidate_claim_token;
      return;
    end if;

    select
      key_row.request_hash,
      key_row.state,
      key_row.locked_until,
      key_row.expires_at,
      key_row.response_status,
      key_row.response_body
    into
      stored_hash,
      stored_state,
      stored_locked_until,
      stored_expires_at,
      stored_response_status,
      stored_response_body
    from public.api_idempotency_keys key_row
    where key_row.tenant_id = target_tenant_id
      and key_row.actor_id = target_actor_id
      and key_row.idempotency_key = target_idempotency_key
    for update;

    if found then
      stored_row_found := true;
      claim_time := pg_catalog.clock_timestamp();
      exit;
    end if;
  end loop;

  if not stored_row_found then
    raise exception using
      errcode = '40001',
      message = 'idempotency claim changed concurrently';
  end if;

  if stored_expires_at <= claim_time then
    candidate_claim_token := pg_catalog.gen_random_uuid();
    update public.api_idempotency_keys key_row
    set
      request_hash = target_request_hash,
      claim_token = candidate_claim_token,
      state = 'processing',
      locked_until = claim_time + target_lock_ttl,
      response_status = null,
      response_body = null,
      expires_at = claim_time + target_retention,
      updated_at = claim_time
    where key_row.tenant_id = target_tenant_id
      and key_row.actor_id = target_actor_id
      and key_row.idempotency_key = target_idempotency_key;

    return query
      select 'claimed'::text, null::smallint, null::jsonb,
        candidate_claim_token;
    return;
  end if;

  if stored_hash <> target_request_hash then
    return query
      select 'idempotency_key_reused'::text, null::smallint, null::jsonb,
        null::uuid;
    return;
  end if;

  if stored_state = 'completed' then
    return query
      select 'replay'::text, stored_response_status, stored_response_body,
        null::uuid;
    return;
  end if;

  if stored_locked_until <= claim_time then
    candidate_claim_token := pg_catalog.gen_random_uuid();
    update public.api_idempotency_keys key_row
    set
      claim_token = candidate_claim_token,
      locked_until = claim_time + target_lock_ttl,
      expires_at = claim_time + target_retention,
      updated_at = claim_time
    where key_row.tenant_id = target_tenant_id
      and key_row.actor_id = target_actor_id
      and key_row.idempotency_key = target_idempotency_key;

    return query
      select 'claimed'::text, null::smallint, null::jsonb,
        candidate_claim_token;
    return;
  end if;

  return query
    select 'idempotency_in_progress'::text, null::smallint, null::jsonb,
      null::uuid;
end;
$$;

create function app_private.complete_idempotency(
  target_tenant_id uuid,
  target_actor_id uuid,
  target_idempotency_key text,
  target_request_hash text,
  target_claim_token uuid,
  completed_status smallint,
  completed_body jsonb,
  target_retention interval default interval '1 day'
)
returns table (
  outcome text,
  response_status smallint,
  response_body jsonb
)
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  completion_time timestamptz;
  stored_hash text;
  stored_claim_token uuid;
  stored_state text;
  stored_expires_at timestamptz;
  stored_response_status smallint;
  stored_response_body jsonb;
begin
  if target_tenant_id is null
    or target_actor_id is null
    or target_idempotency_key is null
    or target_idempotency_key <> pg_catalog.btrim(target_idempotency_key)
    or pg_catalog.octet_length(target_idempotency_key) not between 1 and 200
    or target_request_hash is null
    or target_request_hash !~ '^[0-9a-f]{64}$'
    or target_claim_token is null
    or target_retention is null
    or target_retention <= interval '0 seconds'
    or target_retention > interval '30 days'
  then
    raise exception using
      errcode = '22023',
      message = 'invalid idempotency completion input';
  end if;

  if completed_status is null
    or completed_status not between 200 and 599
    or completed_body is null
    or pg_catalog.jsonb_typeof(completed_body) <> 'object'
  then
    raise exception using
      errcode = '22023',
      message = 'invalid completed response';
  end if;

  if pg_catalog.octet_length(
    pg_catalog.convert_to(completed_body::text, 'UTF8')
  ) > 65536 then
    raise exception using
      errcode = '22023',
      message = 'completed response exceeds the size limit';
  end if;

  if app_private.idempotency_response_has_sensitive_fields(completed_body) then
    raise exception using
      errcode = '22023',
      message = 'completed response contains a sensitive field';
  end if;

  select
    key_row.request_hash,
    key_row.claim_token,
    key_row.state,
    key_row.expires_at,
    key_row.response_status,
    key_row.response_body
  into
    stored_hash,
    stored_claim_token,
    stored_state,
    stored_expires_at,
    stored_response_status,
    stored_response_body
  from public.api_idempotency_keys key_row
  where key_row.tenant_id = target_tenant_id
    and key_row.actor_id = target_actor_id
    and key_row.idempotency_key = target_idempotency_key
  for update;

  completion_time := pg_catalog.clock_timestamp();

  if not found or stored_expires_at <= completion_time then
    return query
      select 'idempotency_in_progress'::text, null::smallint, null::jsonb;
    return;
  end if;

  if stored_hash <> target_request_hash then
    return query
      select 'idempotency_key_reused'::text, null::smallint, null::jsonb;
    return;
  end if;

  if stored_claim_token <> target_claim_token then
    return query
      select 'idempotency_in_progress'::text, null::smallint, null::jsonb;
    return;
  end if;

  if stored_state = 'completed' then
    return query
      select 'replay'::text, stored_response_status, stored_response_body;
    return;
  end if;

  update public.api_idempotency_keys key_row
  set
    state = 'completed',
    locked_until = completion_time,
    response_status = completed_status,
    response_body = completed_body,
    expires_at = completion_time + target_retention,
    updated_at = completion_time
  where key_row.tenant_id = target_tenant_id
    and key_row.actor_id = target_actor_id
    and key_row.idempotency_key = target_idempotency_key;

  return query
    select 'completed'::text, completed_status, completed_body;
end;
$$;

create function app_private.cleanup_expired_idempotency_keys(
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
  if batch_size is null or batch_size not between 1 and 10000 then
    raise exception using
      errcode = '22023',
      message = 'invalid idempotency cleanup batch size';
  end if;

  with expired as (
    select key_row.id
    from public.api_idempotency_keys key_row
    where key_row.expires_at <= pg_catalog.clock_timestamp()
    order by key_row.expires_at, key_row.id
    limit batch_size
    for update skip locked
  )
  delete from public.api_idempotency_keys key_row
  using expired
  where key_row.id = expired.id;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

grant usage, create on schema app_private to v2_maintenance_owner;

alter function app_private.claim_idempotency(
  uuid, uuid, text, text, interval, interval
) owner to v2_function_owner;

alter function app_private.complete_idempotency(
  uuid, uuid, text, text, uuid, smallint, jsonb, interval
) owner to v2_function_owner;

alter function app_private.cleanup_expired_idempotency_keys(integer)
  owner to v2_maintenance_owner;

revoke create on schema app_private from v2_maintenance_owner;

revoke all on function app_private.claim_idempotency(
  uuid, uuid, text, text, interval, interval
) from public, anon, authenticated, service_role, v2_maintenance_owner;

revoke all on function app_private.complete_idempotency(
  uuid, uuid, text, text, uuid, smallint, jsonb, interval
) from public, anon, authenticated, service_role, v2_maintenance_owner;

revoke all on function app_private.cleanup_expired_idempotency_keys(integer)
  from public, anon, authenticated, service_role, v2_function_owner;

alter group v2_function_owner drop user postgres;

alter group v2_maintenance_owner drop user postgres;
