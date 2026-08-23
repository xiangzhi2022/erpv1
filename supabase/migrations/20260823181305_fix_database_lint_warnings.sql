do $$
declare
  function_definition text;
begin
  if exists (select 1 from pg_roles where rolname = 'v2_function_owner') then
    execute 'alter group v2_function_owner add user postgres';
  end if;

  execute 'grant create on schema public to v2_function_owner';

  -- plpgsql_check cannot validate these two compound SQL statements while the
  -- private identity helper has no API-facing EXECUTE grant. Resolve the same
  -- claim directly so the helper stays private and runtime behavior is
  -- unchanged.
  function_definition := pg_catalog.pg_get_functiondef(
    'public.transition_own_production_task(uuid,uuid,text,text)'::regprocedure
  );
  if pg_catalog.strpos(
    function_definition,
    'app_private.current_actor_id()'
  ) = 0 then
    raise exception 'transition_own_production_task identity fragment not found';
  end if;
  execute pg_catalog.replace(
    function_definition,
    'app_private.current_actor_id()',
    'nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid'
  );

  function_definition := pg_catalog.pg_get_functiondef(
    'public.report_work_order_progress(uuid,uuid,text,numeric,text)'::regprocedure
  );
  if pg_catalog.strpos(
    function_definition,
    'app_private.current_actor_id()'
  ) = 0 then
    raise exception 'report_work_order_progress identity fragment not found';
  end if;
  execute pg_catalog.replace(
    function_definition,
    'app_private.current_actor_id()',
    'nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid'
  );

  function_definition := pg_catalog.pg_get_functiondef(
    'app_private.claim_idempotency(uuid,uuid,text,text,interval,interval)'::regprocedure
  );
  if pg_catalog.strpos(function_definition, E'  claim_attempt smallint;\n') = 0 then
    raise exception 'claim_idempotency lint fragment not found';
  end if;
  execute pg_catalog.replace(
    function_definition,
    E'  claim_attempt smallint;\n',
    ''
  );

  function_definition := pg_catalog.pg_get_functiondef(
    'public.replace_employee_role_bindings(uuid,uuid,uuid[])'::regprocedure
  );
  if pg_catalog.strpos(function_definition, E'  existing_member_status text;\n') = 0 then
    raise exception 'replace_employee_role_bindings lint fragment not found';
  end if;
  execute pg_catalog.replace(
    function_definition,
    E'  existing_member_status text;\n',
    ''
  );

  function_definition := pg_catalog.pg_get_functiondef(
    'public.create_order_item_with_pricing(uuid,uuid,jsonb)'::regprocedure
  );
  if pg_catalog.strpos(function_definition, E'  module_order_id uuid;\n') = 0
    or pg_catalog.strpos(
      function_definition,
      'select module_row.order_id into module_order_id from public.order_modules module_row'
    ) = 0 then
    raise exception 'create_order_item_with_pricing lint fragment not found';
  end if;
  function_definition := pg_catalog.replace(
    function_definition,
    E'  module_order_id uuid;\n',
    ''
  );
  function_definition := pg_catalog.replace(
    function_definition,
    'select module_row.order_id into module_order_id from public.order_modules module_row',
    'perform 1 from public.order_modules module_row'
  );
  execute function_definition;

  function_definition := pg_catalog.pg_get_functiondef(
    'public.update_basic_order(uuid,uuid,jsonb)'::regprocedure
  );
  if pg_catalog.strpos(
    function_definition,
    E'    ) status_update;\n\n    select *'
  ) = 0 then
    raise exception 'update_basic_order lint fragment not found';
  end if;
  execute pg_catalog.replace(
    function_definition,
    E'    ) status_update;\n\n    select *',
    E'    ) status_update;\n\n    if transitioned_order_id is distinct from target_order_id then\n      raise exception using errcode = ''P0002'', message = ''ORDER_NOT_FOUND'';\n    end if;\n\n    select *'
  );
end;
$$;

revoke create on schema public from v2_function_owner;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'v2_function_owner') then
    execute 'alter group v2_function_owner drop user postgres';
  end if;
end;
$$;
