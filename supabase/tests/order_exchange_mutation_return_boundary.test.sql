begin;
select plan(3);

select is(
  pg_catalog.pg_get_function_result(
    'public.transition_order_exchange(uuid,text,text,jsonb)'::regprocedure
  ),
  'TABLE(id uuid, status text, updated_at timestamp with time zone)',
  'exchange transition returns only a mutation acknowledgement'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.transition_order_exchange(uuid,text,text,jsonb)',
    'EXECUTE'
  ),
  'authenticated users can execute the exchange transition RPC'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.transition_order_exchange(uuid,text,text,jsonb)',
    'EXECUTE'
  ),
  'anonymous users cannot execute the exchange transition RPC'
);

select * from finish();
rollback;
