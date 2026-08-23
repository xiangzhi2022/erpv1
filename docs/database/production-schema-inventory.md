# Supabase v2 production schema inventory

Snapshot date: 2026-08-23  
Project reference: `jfcsbwdawvsxnmovwlgl`  
PostgreSQL: 17.6

This is a metadata-only inventory. It contains row counts and schema object names, but no business rows, user identifiers, credentials, API keys, cookies, or tokens.

## Migration history

| Version | Name | Statements | Source MD5 |
|---|---|---:|---|
| `20260817083043` | `v2_platform_core` | 19 | `5232f1a91d31247a97a3d6032c759696` |
| `20260817092158` | `v2_platform_rls` | 33 | `9a042c3263aaabc514b8afd2f512672d` |
| `20260817105633` | `v2_platform_iam` | 71 | `68545437ca0dbb7123e1cc4cc67f3d76` |
| `20260817152357` | `v2_platform_idempotency` | 29 | `230749ceaa8cb78a7737422263ef67ea` |
| `20260817180901` | `v2_platform_audit` | 63 | `d46305745b938503af458f2991cbc036` |

The checked-in files in `supabase/migrations/` were recovered from `supabase_migrations.schema_migrations.statements`. Their local MD5 hashes match the source strings exactly.

## Tables

All listed tables have RLS enabled.

| Table | Rows | Columns |
|---|---:|---|
| `public.enterprises` | 1 | `id`, `code`, `name`, `status`, `created_at`, `updated_at` |
| `public.enterprise_memberships` | 1 | `id`, `tenant_id`, `user_id`, `status`, `display_name`, `created_at`, `updated_at` |
| `public.sites` | 0 | `id`, `tenant_id`, `code`, `name`, `site_type`, `status`, `created_at` |
| `public.org_units` | 0 | `id`, `tenant_id`, `site_id`, `parent_id`, `code`, `name`, `unit_type`, `created_at` |
| `public.workshops` | 0 | `id`, `tenant_id`, `site_id`, `code`, `name`, `created_at` |
| `public.workstations` | 0 | `id`, `tenant_id`, `workshop_id`, `code`, `name`, `status`, `created_at` |
| `public.permission_catalog` | 0 | `code`, `description`, `created_at` |
| `public.roles` | 0 | `id`, `tenant_id`, `code`, `name`, `description`, `is_system`, `created_at`, `updated_at` |
| `public.role_permissions` | 0 | `tenant_id`, `role_id`, `permission_code`, `created_at` |
| `public.role_bindings` | 0 | `id`, `tenant_id`, `role_id`, `membership_id`, `scope_kind`, `created_at` |
| `public.role_binding_sites` | 0 | `tenant_id`, `binding_id`, `scope_kind`, `site_id`, `created_at` |
| `public.role_binding_workshops` | 0 | `tenant_id`, `binding_id`, `scope_kind`, `workshop_id`, `created_at` |
| `public.api_idempotency_keys` | 0 | `id`, `tenant_id`, `actor_id`, `idempotency_key`, `request_hash`, `claim_token`, `state`, `locked_until`, `response_status`, `response_body`, `expires_at`, `created_at`, `updated_at` |
| `public.audit_events` | 1 | `id`, `tenant_id`, `membership_id`, `actor_id`, `action`, `resource_type`, `resource_id`, `outcome`, `correlation_id`, `metadata`, `metadata_trusted`, `ip_hash`, `user_agent_summary`, `occurred_at` |
| `public.identity_action_requests` | 2 | `id`, `actor_id`, `action`, `idempotency_key`, `target_hash`, `state`, `result`, `correlation_id`, `locked_until`, `expires_at`, `created_at`, `updated_at` |
| `app_private.security_events` | 1 | `id`, `actor_id`, `event_code`, `attempted_target_hash`, `correlation_id`, `identity_action_request_id`, `occurred_at`, `expires_at` |

Storage buckets: none.

## Constraints and indexes

Constraint type suffixes follow PostgreSQL conventions: `_pkey`, `_fkey`, `_key`, and `_check`.

| Table | Constraints | Non-constraint indexes |
|---|---|---|
| `enterprises` | `enterprises_pkey`, `enterprises_code_key`, `enterprises_status_check` | — |
| `enterprise_memberships` | `enterprise_memberships_pkey`, `enterprise_memberships_tenant_id_fkey`, `enterprise_memberships_user_id_fkey`, `enterprise_memberships_tenant_id_id_key`, `enterprise_memberships_tenant_id_id_user_id_key`, `enterprise_memberships_tenant_id_user_id_key` | `enterprise_memberships_active_lookup_idx`, `enterprise_memberships_tenant_id_idx`, `enterprise_memberships_user_id_idx` |
| `sites` | `sites_pkey`, `sites_tenant_id_fkey`, `sites_tenant_id_code_key`, `sites_tenant_id_id_key`, `sites_site_type_check`, `sites_status_check` | `sites_tenant_id_idx` |
| `org_units` | `org_units_pkey`, `org_units_tenant_id_fkey`, `org_units_tenant_id_parent_id_fkey`, `org_units_tenant_id_site_id_fkey`, `org_units_tenant_id_code_key`, `org_units_tenant_id_id_key` | `org_units_tenant_id_idx`, `org_units_tenant_parent_id_idx`, `org_units_tenant_site_id_idx` |
| `workshops` | `workshops_pkey`, `workshops_tenant_id_fkey`, `workshops_tenant_id_site_id_fkey`, `workshops_tenant_id_code_key`, `workshops_tenant_id_id_key` | `workshops_tenant_id_idx`, `workshops_tenant_site_id_idx` |
| `workstations` | `workstations_pkey`, `workstations_tenant_id_fkey`, `workstations_tenant_id_workshop_id_fkey`, `workstations_tenant_id_code_key`, `workstations_tenant_id_id_key`, `workstations_status_check` | `workstations_tenant_id_idx`, `workstations_tenant_workshop_id_idx` |
| `permission_catalog` | `permission_catalog_pkey` | — |
| `roles` | `roles_pkey`, `roles_tenant_id_fkey`, `roles_tenant_id_code_key`, `roles_tenant_id_id_key` | `roles_tenant_id_idx` |
| `role_permissions` | `role_permissions_pkey`, `role_permissions_tenant_id_role_id_fkey`, `role_permissions_permission_code_fkey` | `role_permissions_permission_code_idx` |
| `role_bindings` | `role_bindings_pkey`, `role_bindings_scope_kind_check`, `role_bindings_tenant_id_membership_id_fkey`, `role_bindings_tenant_id_role_id_fkey`, `role_bindings_tenant_id_id_scope_kind_key`, `role_bindings_tenant_id_role_id_membership_id_scope_kind_key` | `role_bindings_tenant_membership_id_idx`, `role_bindings_tenant_role_id_idx` |
| `role_binding_sites` | `role_binding_sites_pkey`, `role_binding_sites_scope_kind_check`, `role_binding_sites_tenant_id_binding_id_scope_kind_fkey`, `role_binding_sites_tenant_id_site_id_fkey` | `role_binding_sites_tenant_site_id_idx` |
| `role_binding_workshops` | `role_binding_workshops_pkey`, `role_binding_workshops_scope_kind_check`, `role_binding_workshops_tenant_id_binding_id_scope_kind_fkey`, `role_binding_workshops_tenant_id_workshop_id_fkey` | `role_binding_workshops_tenant_workshop_id_idx` |
| `api_idempotency_keys` | `api_idempotency_keys_pkey`, `api_idempotency_keys_tenant_actor_key_key`, `api_idempotency_keys_membership_fkey`, `api_idempotency_keys_key_check`, `api_idempotency_keys_lease_check`, `api_idempotency_keys_request_hash_check`, `api_idempotency_keys_response_check`, `api_idempotency_keys_state_check` | `api_idempotency_keys_expires_at_idx` |
| `audit_events` | `audit_events_pkey`, `audit_events_tenant_id_fkey`, `audit_events_membership_actor_fkey`, `audit_events_action_check`, `audit_events_metadata_check`, `audit_events_metadata_trusted_check`, `audit_events_outcome_check`, `audit_events_resource_check`, `audit_events_user_agent_check` | `audit_events_actor_occurred_at_idx`, `audit_events_membership_id_idx`, `audit_events_tenant_occurred_at_idx` |
| `identity_action_requests` | `identity_action_requests_pkey`, `identity_action_requests_actor_action_key_key`, `identity_action_requests_action_check`, `identity_action_requests_result_check`, `identity_action_requests_state_check`, `identity_action_requests_target_hash_check`, `identity_action_requests_time_bounds_check` | `identity_action_requests_actor_created_at_idx`, `identity_action_requests_expires_at_idx` |
| `app_private.security_events` | `security_events_pkey`, `security_events_identity_action_request_id_key`, `security_events_identity_action_request_id_fkey`, `security_events_attempted_target_hash_check`, `security_events_event_code_check`, `security_events_retention_check` | `security_events_actor_occurred_at_idx`, `security_events_expires_at_id_idx` |

## RLS policies

- `enterprises_select_active_members`
- `enterprise_memberships_select_self_or_members_read`
- `sites_select_organization_read`
- `org_units_select_organization_read`
- `workshops_select_organization_read`
- `workstations_select_organization_read`
- `permission_catalog_select_authenticated`
- `roles_select_roles_manage`
- `role_permissions_select_roles_manage`
- `role_bindings_select_roles_manage`
- `role_binding_sites_select_roles_manage`
- `role_binding_workshops_select_roles_manage`
- `audit_events_select_enterprise_auditors`
- `security_events_select_expired_for_retention`
- `security_events_lock_expired_for_retention`
- `security_events_delete_expired_for_retention`

`api_idempotency_keys` and `identity_action_requests` have RLS enabled with no direct user policies by design. They are accessed through narrow functions. This is documented as an advisor exception, not a reason to add permissive table policies.

## Grants

- `anon` has no table grants on the v2 `public` or `app_private` tables.
- `authenticated` has `SELECT` only on `enterprises`, `enterprise_memberships`, organization tables, permission/RBAC tables, and `audit_events`; RLS further restricts those reads.
- `authenticated` has no direct table grant on `api_idempotency_keys`, `identity_action_requests`, or `app_private.security_events`.
- `service_role` has administrative table privileges on the ordinary public organization/RBAC tables. Server application code must not use this role for normal user operations.

## Functions

Public RPC boundary:

- `public.authorize_enterprise_selection(uuid, uuid, uuid, text)`
- `public.current_enterprise_grants(uuid)`

Private authorization, idempotency, audit, and retention functions:

- `app_private.authorize_enterprise_selection`
- `app_private.can_access_site`
- `app_private.can_access_workshop`
- `app_private.claim_idempotency`
- `app_private.cleanup_expired_idempotency_keys`
- `app_private.cleanup_expired_security_events`
- `app_private.complete_idempotency`
- `app_private.current_actor_id`
- `app_private.effective_grants`
- `app_private.guard_security_event_mutation`
- `app_private.has_enterprise_permission`
- `app_private.has_permission`
- `app_private.idempotency_response_has_sensitive_fields`
- `app_private.is_active_member`
- `app_private.reject_audit_event_mutation`
- `app_private.write_audit_event`

## Advisor findings

Security:

- Info: `public.api_idempotency_keys` has RLS enabled and no policy; documented service-function boundary.
- Info: `public.identity_action_requests` has RLS enabled and no policy; documented service-function boundary.
- Warning: Supabase Auth leaked-password protection is disabled and must be enabled before production acceptance.

Performance:

- Missing covering index for `audit_events_membership_actor_fkey` on `(tenant_id, membership_id, actor_id)`.
- Missing covering index for `role_binding_sites_tenant_id_binding_id_scope_kind_fkey` on `(tenant_id, binding_id, scope_kind)`.
- Missing covering index for `role_binding_workshops_tenant_id_binding_id_scope_kind_fkey` on `(tenant_id, binding_id, scope_kind)`.
- Several indexes are reported unused, but the tables currently contain zero or one rows. No index should be removed from this low-volume snapshot without representative workload evidence.

Local PL/pgSQL lint after replaying the exact baseline reports that `app_private.claim_idempotency` declares an outer `claim_attempt` variable that is shadowed by its integer loop variable, leaving the outer variable unused. The applied baseline file must remain byte-identical; correct this through a new forward migration.

## Environment observation

The publishable key in the historical local project `.env` returned HTTP 401 against the Data API on 2026-08-23. It must not be copied to deployment configuration. Obtain an active publishable key from the Supabase project settings or management API and validate it without printing the value.
