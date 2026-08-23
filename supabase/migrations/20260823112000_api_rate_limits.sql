create table app_private.api_rate_limit_buckets (
  bucket text not null,
  identifier_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null,
  primary key (bucket, identifier_hash),
  check (bucket ~ '^[a-z0-9][a-z0-9._:-]{0,127}$'),
  check (identifier_hash ~ '^[0-9a-f]{64}$'),
  check (request_count > 0)
);

create index api_rate_limit_buckets_window_started_at_idx
  on app_private.api_rate_limit_buckets (window_started_at);

alter table app_private.api_rate_limit_buckets owner to v2_function_owner;

revoke all on table app_private.api_rate_limit_buckets
  from public, anon, authenticated, service_role;

create function app_private.consume_rate_limit(
  target_bucket text,
  target_identifier_hash text,
  target_limit integer,
  target_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  consumed_at timestamptz := clock_timestamp();
  current_count integer;
  current_window_start timestamptz;
begin
  if target_bucket is null
    or target_bucket !~ '^[a-z0-9][a-z0-9._:-]{0,127}$'
    or target_identifier_hash is null
    or target_identifier_hash !~ '^[0-9a-f]{64}$'
    or target_limit is null
    or target_limit < 1
    or target_limit > 1000000
    or target_window_seconds is null
    or target_window_seconds < 1
    or target_window_seconds > 2592000
  then
    raise exception using
      errcode = '22023',
      message = 'rate-limit configuration is invalid';
  end if;

  -- Bound high-cardinality anonymous buckets without adding a cleanup write to
  -- every request. One out of 64 identifiers prunes a small, locked batch.
  if pg_catalog.mod(pg_catalog.hashtextextended(target_identifier_hash, 0), 64) = 0 then
    with expired as (
      select stale.bucket, stale.identifier_hash
      from app_private.api_rate_limit_buckets stale
      where stale.window_started_at < consumed_at - interval '35 days'
      order by stale.window_started_at
      for update skip locked
      limit 128
    )
    delete from app_private.api_rate_limit_buckets stale
    using expired
    where stale.bucket = expired.bucket
      and stale.identifier_hash = expired.identifier_hash;
  end if;

  insert into app_private.api_rate_limit_buckets as bucket_state (
    bucket,
    identifier_hash,
    window_started_at,
    request_count
  ) values (
    target_bucket,
    target_identifier_hash,
    consumed_at,
    1
  )
  on conflict (bucket, identifier_hash) do update
  set window_started_at = case
        when bucket_state.window_started_at
          <= consumed_at - make_interval(secs => target_window_seconds)
        then consumed_at
        else bucket_state.window_started_at
      end,
      request_count = case
        when bucket_state.window_started_at
          <= consumed_at - make_interval(secs => target_window_seconds)
        then 1
        else bucket_state.request_count + 1
      end
  returning request_count, window_started_at
    into current_count, current_window_start;

  return query select
    current_count <= target_limit,
    greatest(target_limit - current_count, 0),
    case
      when current_count <= target_limit then 0
      else greatest(
        ceil(extract(epoch from (
          current_window_start
          + make_interval(secs => target_window_seconds)
          - consumed_at
        )))::integer,
        1
      )
    end;
end;
$$;

alter function app_private.consume_rate_limit(text, text, integer, integer)
  owner to v2_function_owner;

revoke all on function app_private.consume_rate_limit(text, text, integer, integer)
  from public, anon, authenticated, service_role;

create function public.consume_api_rate_limit(
  target_bucket text,
  target_identifier_hash text,
  target_limit integer,
  target_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select result.allowed, result.remaining, result.retry_after_seconds
  from app_private.consume_rate_limit(
    target_bucket,
    target_identifier_hash,
    target_limit,
    target_window_seconds
  ) result;
$$;

alter function public.consume_api_rate_limit(text, text, integer, integer)
  owner to v2_function_owner;

revoke all on function public.consume_api_rate_limit(text, text, integer, integer)
  from public, anon, authenticated, service_role;

grant execute on function public.consume_api_rate_limit(text, text, integer, integer)
  to service_role;
