import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  jsonb,
  pgEnum,
  pgSchema,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: 'string' });

export const membershipStatus = pgEnum('membership_status', [
  'invited',
  'active',
  'suspended',
]);

export const orgUnitType = pgEnum('org_unit_type', ['department', 'team']);

export const enterprises = pgTable(
  'enterprises',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    status: text('status').notNull().default('active'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('enterprises_code_key').on(table.code),
    check('enterprises_status_check', sql`${table.status} in ('active', 'suspended')`),
  ],
);

export const enterpriseMemberships = pgTable(
  'enterprise_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => enterprises.id),
    userId: uuid('user_id').notNull(),
    status: membershipStatus('status').notNull().default('invited'),
    displayName: text('display_name').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('enterprise_memberships_tenant_id_user_id_key').on(table.tenantId, table.userId),
    unique('enterprise_memberships_tenant_id_id_key').on(table.tenantId, table.id),
    unique('enterprise_memberships_tenant_id_id_user_id_key').on(
      table.tenantId,
      table.id,
      table.userId,
    ),
    index('enterprise_memberships_tenant_id_idx').on(table.tenantId),
    index('enterprise_memberships_user_id_idx').on(table.userId),
    index('enterprise_memberships_active_lookup_idx')
      .on(table.tenantId, table.userId)
      .where(sql`${table.status} = 'active'`),
  ],
);

export const sites = pgTable(
  'sites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => enterprises.id),
    code: text('code').notNull(),
    name: text('name').notNull(),
    siteType: text('site_type').notNull(),
    status: text('status').notNull().default('active'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    unique('sites_tenant_id_code_key').on(table.tenantId, table.code),
    unique('sites_tenant_id_id_key').on(table.tenantId, table.id),
    check(
      'sites_site_type_check',
      sql`${table.siteType} in ('headquarters', 'store', 'factory', 'warehouse')`,
    ),
    check('sites_status_check', sql`${table.status} in ('active', 'inactive')`),
    index('sites_tenant_id_idx').on(table.tenantId),
  ],
);

export const orgUnits = pgTable(
  'org_units',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => enterprises.id),
    siteId: uuid('site_id'),
    parentId: uuid('parent_id'),
    code: text('code').notNull(),
    name: text('name').notNull(),
    unitType: orgUnitType('unit_type').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    unique('org_units_tenant_id_code_key').on(table.tenantId, table.code),
    unique('org_units_tenant_id_id_key').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.siteId],
      foreignColumns: [sites.tenantId, sites.id],
      name: 'org_units_tenant_id_site_id_fkey',
    }),
    foreignKey({
      columns: [table.tenantId, table.parentId],
      foreignColumns: [table.tenantId, table.id],
      name: 'org_units_tenant_id_parent_id_fkey',
    }),
    index('org_units_tenant_id_idx').on(table.tenantId),
    index('org_units_tenant_site_id_idx').on(table.tenantId, table.siteId),
    index('org_units_tenant_parent_id_idx').on(table.tenantId, table.parentId),
  ],
);

// The legacy schema currently exports another `workshops` symbol. This alias keeps
// the canonical v2 table unambiguous until the business-table reconciliation lands.
export const organizationWorkshops = pgTable(
  'workshops',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => enterprises.id),
    siteId: uuid('site_id').notNull(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    unique('workshops_tenant_id_code_key').on(table.tenantId, table.code),
    unique('workshops_tenant_id_id_key').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.siteId],
      foreignColumns: [sites.tenantId, sites.id],
      name: 'workshops_tenant_id_site_id_fkey',
    }),
    index('workshops_tenant_id_idx').on(table.tenantId),
    index('workshops_tenant_site_id_idx').on(table.tenantId, table.siteId),
  ],
);

export const workstations = pgTable(
  'workstations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => enterprises.id),
    workshopId: uuid('workshop_id').notNull(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    status: text('status').notNull().default('active'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    unique('workstations_tenant_id_code_key').on(table.tenantId, table.code),
    unique('workstations_tenant_id_id_key').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.workshopId],
      foreignColumns: [organizationWorkshops.tenantId, organizationWorkshops.id],
      name: 'workstations_tenant_id_workshop_id_fkey',
    }),
    check('workstations_status_check', sql`${table.status} in ('active', 'inactive')`),
    index('workstations_tenant_id_idx').on(table.tenantId),
    index('workstations_tenant_workshop_id_idx').on(table.tenantId, table.workshopId),
  ],
);

export const permissionCatalog = pgTable('permission_catalog', {
  code: text('code').primaryKey(),
  description: text('description').notNull(),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
});

export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => enterprises.id),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('roles_tenant_id_code_key').on(table.tenantId, table.code),
    unique('roles_tenant_id_id_key').on(table.tenantId, table.id),
    index('roles_tenant_id_idx').on(table.tenantId),
  ],
);

export const rolePermissions = pgTable(
  'role_permissions',
  {
    tenantId: uuid('tenant_id').notNull(),
    roleId: uuid('role_id').notNull(),
    permissionCode: text('permission_code').notNull().references(() => permissionCatalog.code),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.roleId, table.permissionCode] }),
    foreignKey({
      columns: [table.tenantId, table.roleId],
      foreignColumns: [roles.tenantId, roles.id],
      name: 'role_permissions_tenant_id_role_id_fkey',
    }).onDelete('cascade'),
    index('role_permissions_permission_code_idx').on(table.permissionCode),
  ],
);

export const roleBindings = pgTable(
  'role_bindings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    roleId: uuid('role_id').notNull(),
    membershipId: uuid('membership_id').notNull(),
    scopeKind: text('scope_kind').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    unique('role_bindings_tenant_id_id_scope_kind_key').on(
      table.tenantId,
      table.id,
      table.scopeKind,
    ),
    unique('role_bindings_tenant_id_role_id_membership_id_scope_kind_key').on(
      table.tenantId,
      table.roleId,
      table.membershipId,
      table.scopeKind,
    ),
    check(
      'role_bindings_scope_kind_check',
      sql`${table.scopeKind} in ('enterprise', 'sites', 'workshops', 'self')`,
    ),
    foreignKey({
      columns: [table.tenantId, table.roleId],
      foreignColumns: [roles.tenantId, roles.id],
      name: 'role_bindings_tenant_id_role_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.tenantId, table.membershipId],
      foreignColumns: [enterpriseMemberships.tenantId, enterpriseMemberships.id],
      name: 'role_bindings_tenant_id_membership_id_fkey',
    }).onDelete('cascade'),
    index('role_bindings_tenant_role_id_idx').on(table.tenantId, table.roleId),
    index('role_bindings_tenant_membership_id_idx').on(table.tenantId, table.membershipId),
  ],
);

export const roleBindingSites = pgTable(
  'role_binding_sites',
  {
    tenantId: uuid('tenant_id').notNull(),
    bindingId: uuid('binding_id').notNull(),
    scopeKind: text('scope_kind').notNull().default('sites'),
    siteId: uuid('site_id').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.bindingId, table.siteId] }),
    check('role_binding_sites_scope_kind_check', sql`${table.scopeKind} = 'sites'`),
    foreignKey({
      columns: [table.tenantId, table.bindingId, table.scopeKind],
      foreignColumns: [roleBindings.tenantId, roleBindings.id, roleBindings.scopeKind],
      name: 'role_binding_sites_tenant_id_binding_id_scope_kind_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.tenantId, table.siteId],
      foreignColumns: [sites.tenantId, sites.id],
      name: 'role_binding_sites_tenant_id_site_id_fkey',
    }).onDelete('cascade'),
    index('role_binding_sites_tenant_site_id_idx').on(table.tenantId, table.siteId),
  ],
);

export const roleBindingWorkshops = pgTable(
  'role_binding_workshops',
  {
    tenantId: uuid('tenant_id').notNull(),
    bindingId: uuid('binding_id').notNull(),
    scopeKind: text('scope_kind').notNull().default('workshops'),
    workshopId: uuid('workshop_id').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.bindingId, table.workshopId] }),
    check('role_binding_workshops_scope_kind_check', sql`${table.scopeKind} = 'workshops'`),
    foreignKey({
      columns: [table.tenantId, table.bindingId, table.scopeKind],
      foreignColumns: [roleBindings.tenantId, roleBindings.id, roleBindings.scopeKind],
      name: 'role_binding_workshops_tenant_id_binding_id_scope_kind_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.tenantId, table.workshopId],
      foreignColumns: [organizationWorkshops.tenantId, organizationWorkshops.id],
      name: 'role_binding_workshops_tenant_id_workshop_id_fkey',
    }).onDelete('cascade'),
    index('role_binding_workshops_tenant_workshop_id_idx').on(
      table.tenantId,
      table.workshopId,
    ),
  ],
);

export const apiIdempotencyKeys = pgTable(
  'api_idempotency_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    actorId: uuid('actor_id').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    requestHash: text('request_hash').notNull(),
    claimToken: uuid('claim_token').notNull(),
    state: text('state').notNull(),
    lockedUntil: timestamptz('locked_until').notNull(),
    responseStatus: smallint('response_status'),
    responseBody: jsonb('response_body'),
    expiresAt: timestamptz('expires_at').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('api_idempotency_keys_tenant_actor_key_key').on(
      table.tenantId,
      table.actorId,
      table.idempotencyKey,
    ),
    foreignKey({
      columns: [table.tenantId, table.actorId],
      foreignColumns: [enterpriseMemberships.tenantId, enterpriseMemberships.userId],
      name: 'api_idempotency_keys_membership_fkey',
    }).onDelete('cascade'),
    index('api_idempotency_keys_expires_at_idx').on(table.expiresAt, table.id),
  ],
);

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => enterprises.id),
    membershipId: uuid('membership_id').notNull(),
    actorId: uuid('actor_id').notNull(),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: uuid('resource_id').notNull(),
    outcome: text('outcome').notNull(),
    correlationId: uuid('correlation_id').notNull(),
    metadata: jsonb('metadata').notNull(),
    metadataTrusted: boolean('metadata_trusted').notNull(),
    ipHash: text('ip_hash'),
    userAgentSummary: text('user_agent_summary'),
    occurredAt: timestamptz('occurred_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.membershipId, table.actorId],
      foreignColumns: [
        enterpriseMemberships.tenantId,
        enterpriseMemberships.id,
        enterpriseMemberships.userId,
      ],
      name: 'audit_events_membership_actor_fkey',
    }),
    index('audit_events_tenant_occurred_at_idx').on(
      table.tenantId,
      table.occurredAt.desc(),
      table.id,
    ),
    index('audit_events_actor_occurred_at_idx').on(
      table.actorId,
      table.occurredAt.desc(),
      table.id,
    ),
    index('audit_events_membership_id_idx').on(table.tenantId, table.membershipId),
  ],
);

export const identityActionRequests = pgTable(
  'identity_action_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').notNull(),
    action: text('action').notNull(),
    idempotencyKey: uuid('idempotency_key').notNull(),
    targetHash: text('target_hash').notNull(),
    state: text('state').notNull(),
    result: jsonb('result'),
    correlationId: uuid('correlation_id').notNull(),
    lockedUntil: timestamptz('locked_until').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('identity_action_requests_actor_action_key_key').on(
      table.actorId,
      table.action,
      table.idempotencyKey,
    ),
    index('identity_action_requests_expires_at_idx').on(table.expiresAt, table.id),
    index('identity_action_requests_actor_created_at_idx').on(
      table.actorId,
      table.createdAt.desc(),
      table.id,
    ),
  ],
);

const appPrivate = pgSchema('app_private');

export const securityEvents = appPrivate.table(
  'security_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').notNull(),
    eventCode: text('event_code').notNull(),
    attemptedTargetHash: text('attempted_target_hash').notNull(),
    correlationId: uuid('correlation_id').notNull(),
    identityActionRequestId: uuid('identity_action_request_id')
      .notNull()
      .references(() => identityActionRequests.id),
    occurredAt: timestamptz('occurred_at').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
  },
  (table) => [
    uniqueIndex('security_events_identity_action_request_id_key').on(
      table.identityActionRequestId,
    ),
    index('security_events_expires_at_id_idx').on(table.expiresAt, table.id),
    index('security_events_actor_occurred_at_idx').on(
      table.actorId,
      table.occurredAt.desc(),
      table.id,
    ),
  ],
);

export type Enterprise = typeof enterprises.$inferSelect;
export type EnterpriseMembership = typeof enterpriseMemberships.$inferSelect;
export type V2Role = typeof roles.$inferSelect;
export type V2RolePermission = typeof rolePermissions.$inferSelect;
