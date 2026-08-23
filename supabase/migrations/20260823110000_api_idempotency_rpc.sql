create function public.claim_api_idempotency(
  target_enterprise_id uuid,
  target_idempotency_key text,
  target_request_hash text
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
  current_actor_id uuid;
begin
  current_actor_id := auth.uid();
  if current_actor_id is null then
    raise exception using errcode = '42501', message = 'authenticated identity required';
  end if;
  if not app_private.is_active_member(target_enterprise_id) then
    raise exception using errcode = '42501', message = 'active enterprise membership required';
  end if;

  return query
    select claim.outcome, claim.response_status, claim.response_body, claim.claim_token
    from app_private.claim_idempotency(
      target_enterprise_id,
      current_actor_id,
      target_idempotency_key,
      target_request_hash
    ) claim;
end;
$$;

create function public.complete_api_idempotency(
  target_enterprise_id uuid,
  target_idempotency_key text,
  target_request_hash text,
  target_claim_token uuid,
  completed_status smallint,
  completed_body jsonb
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
  current_actor_id uuid;
begin
  current_actor_id := auth.uid();
  if current_actor_id is null then
    raise exception using errcode = '42501', message = 'authenticated identity required';
  end if;
  if not app_private.is_active_member(target_enterprise_id) then
    raise exception using errcode = '42501', message = 'active enterprise membership required';
  end if;

  return query
    select completion.outcome, completion.response_status, completion.response_body
    from app_private.complete_idempotency(
      target_enterprise_id,
      current_actor_id,
      target_idempotency_key,
      target_request_hash,
      target_claim_token,
      completed_status,
      completed_body
    ) completion;
end;
$$;

alter function public.claim_api_idempotency(uuid, text, text)
  owner to v2_function_owner;

alter function public.complete_api_idempotency(uuid, text, text, uuid, smallint, jsonb)
  owner to v2_function_owner;

revoke all on function public.claim_api_idempotency(uuid, text, text)
  from public, anon, authenticated, service_role;

revoke all on function public.complete_api_idempotency(uuid, text, text, uuid, smallint, jsonb)
  from public, anon, authenticated, service_role;

grant execute on function public.claim_api_idempotency(uuid, text, text)
  to authenticated;

grant execute on function public.complete_api_idempotency(uuid, text, text, uuid, smallint, jsonb)
  to authenticated;

revoke all on function app_private.claim_idempotency(
  uuid, uuid, text, text, interval, interval
) from public, anon, authenticated, service_role;

revoke all on function app_private.complete_idempotency(
  uuid, uuid, text, text, uuid, smallint, jsonb, interval
) from public, anon, authenticated, service_role;
