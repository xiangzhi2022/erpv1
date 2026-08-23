begin;

select plan(18);

select has_table(
  'app_private',
  'api_rate_limit_buckets',
  'rate-limit buckets are stored outside the public API schema'
);

select has_index(
  'app_private',
  'api_rate_limit_buckets',
  'api_rate_limit_buckets_window_started_at_idx',
  'expired rate-limit buckets have a cleanup index'
);

select ok(
  to_regprocedure('app_private.consume_rate_limit(text,text,integer,integer)') is not null,
  'private atomic rate-limit function exists'
);

select ok(
  to_regprocedure('public.consume_api_rate_limit(text,text,integer,integer)') is not null,
  'service-role wrapper exists'
);

select is(
  (select pg_get_userbyid(relowner) from pg_class where oid = 'app_private.api_rate_limit_buckets'::regclass),
  'v2_function_owner',
  'bucket table has the dedicated owner'
);

select is(
  (select pg_get_userbyid(proowner) from pg_proc where oid = 'app_private.consume_rate_limit(text,text,integer,integer)'::regprocedure),
  'v2_function_owner',
  'private consumer has the dedicated owner'
);

select ok(
  not has_table_privilege('anon', 'app_private.api_rate_limit_buckets', 'SELECT')
  and not has_table_privilege('authenticated', 'app_private.api_rate_limit_buckets', 'SELECT')
  and not has_table_privilege('service_role', 'app_private.api_rate_limit_buckets', 'SELECT'),
  'no API role can read raw bucket rows'
);

select ok(
  not has_function_privilege('anon', 'public.consume_api_rate_limit(text,text,integer,integer)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.consume_api_rate_limit(text,text,integer,integer)', 'EXECUTE'),
  'browser roles cannot execute the public wrapper'
);

select ok(
  has_function_privilege('service_role', 'public.consume_api_rate_limit(text,text,integer,integer)', 'EXECUTE'),
  'service role can execute the public wrapper'
);

select ok(
  not has_function_privilege('service_role', 'app_private.consume_rate_limit(text,text,integer,integer)', 'EXECUTE'),
  'service role cannot bypass the public wrapper'
);

select throws_ok(
  $$ select * from app_private.consume_rate_limit('auth.login.ip', 'raw-ip', 10, 900) $$,
  '22023',
  'rate-limit configuration is invalid',
  'raw identifiers are rejected'
);

select throws_ok(
  $$ select * from app_private.consume_rate_limit('auth.login.ip', repeat('a', 64), 0, 900) $$,
  '22023',
  'rate-limit configuration is invalid',
  'invalid limits are rejected'
);

select ok(
  (select prosrc from pg_proc where oid = 'app_private.consume_rate_limit(text,text,integer,integer)'::regprocedure)
    ~ 'on conflict[\s\S]*do update',
  'bucket consumption uses one atomic upsert'
);

select ok(
  (select prosrc from pg_proc where oid = 'app_private.consume_rate_limit(text,text,integer,integer)'::regprocedure)
    ~ 'for update skip locked[\s\S]*limit 128',
  'bucket consumption performs bounded opportunistic TTL cleanup'
);

select results_eq(
  $$
    select allowed, remaining, retry_after_seconds
    from app_private.consume_rate_limit('test.behavior', repeat('b', 64), 2, 900)
  $$,
  $$values (true, 1, 0)$$,
  'the first request consumes one unit'
);

select results_eq(
  $$
    select allowed, remaining, retry_after_seconds
    from app_private.consume_rate_limit('test.behavior', repeat('b', 64), 2, 900)
  $$,
  $$values (true, 0, 0)$$,
  'the request at the configured limit is still allowed'
);

select results_eq(
  $$
    select allowed, remaining, retry_after_seconds > 0
    from app_private.consume_rate_limit('test.behavior', repeat('b', 64), 2, 900)
  $$,
  $$values (false, 0, true)$$,
  'the next request is denied with a positive retry interval'
);

update app_private.api_rate_limit_buckets
set window_started_at = clock_timestamp() - interval '901 seconds',
    request_count = 99
where bucket = 'test.behavior'
  and identifier_hash = repeat('b', 64);

select results_eq(
  $$
    select allowed, remaining, retry_after_seconds
    from app_private.consume_rate_limit('test.behavior', repeat('b', 64), 2, 900)
  $$,
  $$values (true, 1, 0)$$,
  'an expired fixed window rolls over atomically'
);

select * from finish();

rollback;
