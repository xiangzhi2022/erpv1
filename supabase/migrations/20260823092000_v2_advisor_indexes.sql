alter group v2_function_owner add user postgres;
grant create on schema public to v2_function_owner;
set role v2_function_owner;

create index if not exists audit_events_membership_actor_idx
  on public.audit_events (tenant_id, membership_id, actor_id);

reset role;

create index if not exists role_binding_sites_binding_scope_idx
  on public.role_binding_sites (tenant_id, binding_id, scope_kind);

create index if not exists role_binding_workshops_binding_scope_idx
  on public.role_binding_workshops (tenant_id, binding_id, scope_kind);

revoke create on schema public from v2_function_owner;
alter group v2_function_owner drop user postgres;
