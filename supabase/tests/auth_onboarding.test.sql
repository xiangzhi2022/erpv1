begin;

select plan(12);

select has_function(
  'public',
  'onboard_enterprise',
  array['text', 'text', 'text'],
  'authenticated enterprise onboarding function exists'
);

select function_privs_are(
  'public',
  'onboard_enterprise',
  array['text', 'text', 'text'],
  'anon',
  array[]::text[],
  'anonymous callers cannot provision enterprises'
);

select function_privs_are(
  'public',
  'onboard_enterprise',
  array['text', 'text', 'text'],
  'authenticated',
  array['EXECUTE'],
  'authenticated callers can provision their enterprise'
);

select ok(
  to_regclass('app_private.legacy_identity_mappings') is not null,
  'stable legacy-to-Auth identity mappings are private'
);

insert into auth.users (id, email, email_confirmed_at, created_at, updated_at)
values (
  'c0000000-0000-4000-8000-000000000001',
  'onboarding@example.invalid',
  now(),
  now(),
  now()
);

select set_config(
  'test.standard_permission_count',
  (
    select count(*)::text
    from public.role_permissions permission
    join public.roles role on role.id = permission.role_id
    join public.enterprises enterprise on enterprise.id = role.tenant_id
    where enterprise.code = 'platform-profiles'
  ),
  true
);

select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-000000000001', true);
set local role authenticated;

create temporary table onboarding_result on commit drop as
select public.onboard_enterprise('王店长', '青崖测试企业', 'manufacturer') as enterprise_id;

select results_eq(
  $$select count(*)::bigint from public.enterprises enterprise join onboarding_result result on result.enterprise_id = enterprise.id where enterprise.name = '青崖测试企业' and enterprise.enterprise_type = 'manufacturer'$$,
  $$values (1::bigint)$$,
  'onboarding creates one concrete enterprise'
);

select results_eq(
  $$select count(*)::bigint from public.enterprise_memberships membership join onboarding_result result on result.enterprise_id = membership.tenant_id where membership.user_id = 'c0000000-0000-4000-8000-000000000001' and membership.status = 'active' and membership.display_name = '王店长'$$,
  $$values (1::bigint)$$,
  'onboarding creates the active owner membership'
);

select results_eq(
  $$select count(*)::bigint from public.roles role join onboarding_result result on result.enterprise_id = role.tenant_id where role.is_system$$,
  $$values (10::bigint)$$,
  'onboarding seeds every standard system role'
);

select results_eq(
  $$select count(*)::bigint from public.role_bindings binding join onboarding_result result on result.enterprise_id = binding.tenant_id join public.roles role on role.id = binding.role_id where role.code = 'enterprise_owner' and binding.scope_kind = 'enterprise'$$,
  $$values (1::bigint)$$,
  'onboarding binds the caller to the enterprise owner role'
);

select results_eq(
  $$select count(*)::bigint from public.role_permissions permission join onboarding_result result on result.enterprise_id = permission.tenant_id$$,
  $$select current_setting('test.standard_permission_count')::bigint$$,
  'onboarding copies the complete standard permission matrix'
);

select results_eq(
  $$select count(*)::bigint from public.profiles profile join onboarding_result result on result.enterprise_id = profile.enterprise_id where profile.id = 'c0000000-0000-4000-8000-000000000001' and profile.display_name = '王店长'$$,
  $$values (1::bigint)$$,
  'onboarding moves the blank profile into the new enterprise'
);

select throws_ok(
  $$select public.onboard_enterprise('王店长', '重复企业', 'dealer')$$,
  'P0001',
  'identity already has an enterprise membership',
  'an identity cannot accidentally provision a second initial enterprise'
);

reset role;

select ok(
  not has_table_privilege('anon', 'app_private.legacy_identity_mappings', 'SELECT')
  and not has_table_privilege('authenticated', 'app_private.legacy_identity_mappings', 'SELECT'),
  'legacy identity mappings are not exposed to application roles'
);

select * from finish();

rollback;
