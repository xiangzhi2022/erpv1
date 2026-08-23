import { relations } from 'drizzle-orm/relations';

import {
  categories,
  customers,
  dealers,
  departments,
  employeePositions,
  employeeRoles,
  employees,
  enterpriseJoinRequests,
  enterpriseMemberships,
  enterprises,
  factoryWorkshops,
  notifications,
  orderExchanges,
  orderItemAttachments,
  orderItems,
  orderModules,
  orderPrefixes,
  orderProducts,
  orders,
  orderSpaces,
  orderStatusLogs,
  organizationWorkshops,
  permissionCatalog,
  positions,
  productionTasks,
  profiles,
  progressLogs,
  roleBindingSites,
  roleBindingWorkshops,
  roleBindings,
  rolePermissions,
  roles,
  sites,
  suppliers,
  tasks,
  userSettings,
  wageRules,
  workOrders,
  workerWageRecords,
  workers,
  workstations,
} from './schema';

export const enterprisesRelations = relations(enterprises, ({ many }) => ({
  memberships: many(enterpriseMemberships),
  sites: many(sites),
  workshops: many(organizationWorkshops),
  roles: many(roles),
  profiles: many(profiles),
  customers: many(customers),
  departments: many(departments),
  positions: many(positions),
  employees: many(employees),
  employeePositions: many(employeePositions),
  employeeRoles: many(employeeRoles),
  orderPrefixes: many(orderPrefixes),
  orders: many(orders, { relationName: 'orderEnterprise' }),
  orderSpaces: many(orderSpaces),
  orderProducts: many(orderProducts),
  orderModules: many(orderModules),
  orderItems: many(orderItems),
  orderItemAttachments: many(orderItemAttachments),
  orderExchanges: many(orderExchanges, { relationName: 'exchangeEnterprise' }),
  factoryWorkshops: many(factoryWorkshops),
  productionTasks: many(productionTasks),
  wageRules: many(wageRules),
  workerWageRecords: many(workerWageRecords),
  orderStatusLogs: many(orderStatusLogs),
  workOrders: many(workOrders, { relationName: 'workOrderEnterprise' }),
  progressLogs: many(progressLogs),
  workers: many(workers),
  suppliers: many(suppliers),
  dealers: many(dealers),
  categories: many(categories),
  tasks: many(tasks),
  notifications: many(notifications),
  userSettings: many(userSettings),
  joinRequests: many(enterpriseJoinRequests),
}));

export const enterpriseMembershipsRelations = relations(
  enterpriseMemberships,
  ({ one, many }) => ({
    enterprise: one(enterprises, {
      fields: [enterpriseMemberships.tenantId],
      references: [enterprises.id],
    }),
    roleBindings: many(roleBindings),
  }),
);

export const rolesRelations = relations(roles, ({ one, many }) => ({
  enterprise: one(enterprises, {
    fields: [roles.tenantId],
    references: [enterprises.id],
  }),
  permissions: many(rolePermissions),
  bindings: many(roleBindings),
  employees: many(employeeRoles),
}));

export const permissionCatalogRelations = relations(permissionCatalog, ({ many }) => ({
  roles: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.tenantId, rolePermissions.roleId],
    references: [roles.tenantId, roles.id],
  }),
  permission: one(permissionCatalog, {
    fields: [rolePermissions.permissionCode],
    references: [permissionCatalog.code],
  }),
}));

export const roleBindingsRelations = relations(roleBindings, ({ one, many }) => ({
  role: one(roles, {
    fields: [roleBindings.tenantId, roleBindings.roleId],
    references: [roles.tenantId, roles.id],
  }),
  membership: one(enterpriseMemberships, {
    fields: [roleBindings.tenantId, roleBindings.membershipId],
    references: [enterpriseMemberships.tenantId, enterpriseMemberships.id],
  }),
  sites: many(roleBindingSites),
  workshops: many(roleBindingWorkshops),
}));

export const roleBindingSitesRelations = relations(roleBindingSites, ({ one }) => ({
  binding: one(roleBindings, {
    fields: [roleBindingSites.tenantId, roleBindingSites.bindingId, roleBindingSites.scopeKind],
    references: [roleBindings.tenantId, roleBindings.id, roleBindings.scopeKind],
  }),
  site: one(sites, {
    fields: [roleBindingSites.tenantId, roleBindingSites.siteId],
    references: [sites.tenantId, sites.id],
  }),
}));

export const roleBindingWorkshopsRelations = relations(roleBindingWorkshops, ({ one }) => ({
  binding: one(roleBindings, {
    fields: [roleBindingWorkshops.tenantId, roleBindingWorkshops.bindingId, roleBindingWorkshops.scopeKind],
    references: [roleBindings.tenantId, roleBindings.id, roleBindings.scopeKind],
  }),
  workshop: one(organizationWorkshops, {
    fields: [roleBindingWorkshops.tenantId, roleBindingWorkshops.workshopId],
    references: [organizationWorkshops.tenantId, organizationWorkshops.id],
  }),
}));

export const sitesRelations = relations(sites, ({ one, many }) => ({
  enterprise: one(enterprises, { fields: [sites.tenantId], references: [enterprises.id] }),
  workshops: many(organizationWorkshops),
  bindings: many(roleBindingSites),
}));

export const organizationWorkshopsRelations = relations(
  organizationWorkshops,
  ({ one, many }) => ({
    enterprise: one(enterprises, {
      fields: [organizationWorkshops.tenantId],
      references: [enterprises.id],
    }),
    site: one(sites, {
      fields: [organizationWorkshops.tenantId, organizationWorkshops.siteId],
      references: [sites.tenantId, sites.id],
    }),
    workstations: many(workstations),
    workers: many(workers),
    workOrders: many(workOrders),
    productionTasks: many(productionTasks),
    bindings: many(roleBindingWorkshops),
  }),
);

export const workstationsRelations = relations(workstations, ({ one, many }) => ({
  workshop: one(organizationWorkshops, {
    fields: [workstations.tenantId, workstations.workshopId],
    references: [organizationWorkshops.tenantId, organizationWorkshops.id],
  }),
  productionTasks: many(productionTasks),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  enterprise: one(enterprises, { fields: [profiles.enterprise_id], references: [enterprises.id] }),
}));

export const customersRelations = relations(customers, ({ one }) => ({
  enterprise: one(enterprises, { fields: [customers.enterprise_id], references: [enterprises.id] }),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  enterprise: one(enterprises, { fields: [departments.enterprise_id], references: [enterprises.id] }),
  parent: one(departments, {
    fields: [departments.enterprise_id, departments.parent_id],
    references: [departments.enterprise_id, departments.id],
    relationName: 'departmentParent',
  }),
  children: many(departments, { relationName: 'departmentParent' }),
  positions: many(positions),
  employees: many(employees),
}));

export const positionsRelations = relations(positions, ({ one, many }) => ({
  enterprise: one(enterprises, { fields: [positions.enterprise_id], references: [enterprises.id] }),
  department: one(departments, {
    fields: [positions.enterprise_id, positions.department_id],
    references: [departments.enterprise_id, departments.id],
  }),
  employees: many(employees),
  employeePositions: many(employeePositions),
  wageRules: many(wageRules),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  enterprise: one(enterprises, { fields: [employees.enterprise_id], references: [enterprises.id] }),
  department: one(departments, {
    fields: [employees.enterprise_id, employees.department_id],
    references: [departments.enterprise_id, departments.id],
  }),
  primaryPosition: one(positions, {
    fields: [employees.enterprise_id, employees.primary_position_id],
    references: [positions.enterprise_id, positions.id],
  }),
  positions: many(employeePositions),
  roles: many(employeeRoles),
}));

export const employeePositionsRelations = relations(employeePositions, ({ one }) => ({
  enterprise: one(enterprises, { fields: [employeePositions.enterprise_id], references: [enterprises.id] }),
  employee: one(employees, {
    fields: [employeePositions.enterprise_id, employeePositions.employee_id],
    references: [employees.enterprise_id, employees.id],
  }),
  position: one(positions, {
    fields: [employeePositions.enterprise_id, employeePositions.position_id],
    references: [positions.enterprise_id, positions.id],
  }),
}));

export const employeeRolesRelations = relations(employeeRoles, ({ one }) => ({
  enterprise: one(enterprises, { fields: [employeeRoles.enterprise_id], references: [enterprises.id] }),
  employee: one(employees, {
    fields: [employeeRoles.enterprise_id, employeeRoles.employee_id],
    references: [employees.enterprise_id, employees.id],
  }),
  role: one(roles, {
    fields: [employeeRoles.enterprise_id, employeeRoles.role_id],
    references: [roles.tenantId, roles.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  enterprise: one(enterprises, {
    fields: [orders.enterprise_id], references: [enterprises.id], relationName: 'orderEnterprise',
  }),
  parent: one(orders, {
    fields: [orders.enterprise_id, orders.parent_order_id],
    references: [orders.enterprise_id, orders.id],
    relationName: 'parentOrder',
  }),
  children: many(orders, { relationName: 'parentOrder' }),
  spaces: many(orderSpaces),
  products: many(orderProducts),
  modules: many(orderModules),
  items: many(orderItems),
  attachments: many(orderItemAttachments),
  exchanges: many(orderExchanges),
  workOrders: many(workOrders),
  productionTasks: many(productionTasks),
}));

export const orderSpacesRelations = relations(orderSpaces, ({ one, many }) => ({
  enterprise: one(enterprises, { fields: [orderSpaces.enterprise_id], references: [enterprises.id] }),
  order: one(orders, {
    fields: [orderSpaces.enterprise_id, orderSpaces.order_id],
    references: [orders.enterprise_id, orders.id],
  }),
  products: many(orderProducts),
  productionTasks: many(productionTasks),
}));

export const orderProductsRelations = relations(orderProducts, ({ one, many }) => ({
  enterprise: one(enterprises, { fields: [orderProducts.enterprise_id], references: [enterprises.id] }),
  order: one(orders, {
    fields: [orderProducts.enterprise_id, orderProducts.order_id],
    references: [orders.enterprise_id, orders.id],
  }),
  space: one(orderSpaces, {
    fields: [orderProducts.enterprise_id, orderProducts.space_id],
    references: [orderSpaces.enterprise_id, orderSpaces.id],
  }),
  productionTasks: many(productionTasks),
}));

export const orderModulesRelations = relations(orderModules, ({ one, many }) => ({
  enterprise: one(enterprises, { fields: [orderModules.enterprise_id], references: [enterprises.id] }),
  order: one(orders, {
    fields: [orderModules.enterprise_id, orderModules.order_id],
    references: [orders.enterprise_id, orders.id],
  }),
  items: many(orderItems),
  attachments: many(orderItemAttachments),
}));

export const orderItemsRelations = relations(orderItems, ({ one, many }) => ({
  enterprise: one(enterprises, { fields: [orderItems.enterprise_id], references: [enterprises.id] }),
  order: one(orders, {
    fields: [orderItems.enterprise_id, orderItems.order_id],
    references: [orders.enterprise_id, orders.id],
  }),
  module: one(orderModules, {
    fields: [orderItems.enterprise_id, orderItems.module_id],
    references: [orderModules.enterprise_id, orderModules.id],
  }),
  attachments: many(orderItemAttachments),
}));

export const orderItemAttachmentsRelations = relations(orderItemAttachments, ({ one }) => ({
  enterprise: one(enterprises, { fields: [orderItemAttachments.enterprise_id], references: [enterprises.id] }),
  item: one(orderItems, {
    fields: [orderItemAttachments.enterprise_id, orderItemAttachments.order_item_id],
    references: [orderItems.enterprise_id, orderItems.id],
  }),
}));

export const productionTasksRelations = relations(productionTasks, ({ one, many }) => ({
  enterprise: one(enterprises, { fields: [productionTasks.enterprise_id], references: [enterprises.id] }),
  workOrder: one(workOrders, {
    fields: [productionTasks.enterprise_id, productionTasks.work_order_id],
    references: [workOrders.enterprise_id, workOrders.id],
  }),
  order: one(orders, {
    fields: [productionTasks.enterprise_id, productionTasks.order_id],
    references: [orders.enterprise_id, orders.id],
  }),
  workshop: one(organizationWorkshops, {
    fields: [productionTasks.enterprise_id, productionTasks.workshop_id],
    references: [organizationWorkshops.tenantId, organizationWorkshops.id],
  }),
  workstation: one(workstations, {
    fields: [productionTasks.enterprise_id, productionTasks.workstation_id],
    references: [workstations.tenantId, workstations.id],
  }),
  worker: one(workers, {
    fields: [productionTasks.enterprise_id, productionTasks.worker_id],
    references: [workers.enterprise_id, workers.id],
    relationName: 'taskWorker',
  }),
  assignedWorker: one(workers, {
    fields: [productionTasks.enterprise_id, productionTasks.assigned_worker_id],
    references: [workers.enterprise_id, workers.id],
    relationName: 'assignedTaskWorker',
  }),
  wageRecords: many(workerWageRecords),
}));

export const workersRelations = relations(workers, ({ one, many }) => ({
  enterprise: one(enterprises, { fields: [workers.enterprise_id], references: [enterprises.id] }),
  workshop: one(organizationWorkshops, {
    fields: [workers.enterprise_id, workers.workshop_id],
    references: [organizationWorkshops.tenantId, organizationWorkshops.id],
  }),
  tasks: many(productionTasks, { relationName: 'taskWorker' }),
  assignedTasks: many(productionTasks, { relationName: 'assignedTaskWorker' }),
  wageRecords: many(workerWageRecords),
  wageRules: many(wageRules),
}));

export const workOrdersRelations = relations(workOrders, ({ one, many }) => ({
  enterprise: one(enterprises, {
    fields: [workOrders.enterprise_id], references: [enterprises.id], relationName: 'workOrderEnterprise',
  }),
  order: one(orders, {
    fields: [workOrders.enterprise_id, workOrders.order_id],
    references: [orders.enterprise_id, orders.id],
  }),
  workshop: one(organizationWorkshops, {
    fields: [workOrders.enterprise_id, workOrders.workshop_id],
    references: [organizationWorkshops.tenantId, organizationWorkshops.id],
  }),
  tasks: many(productionTasks),
  logs: many(progressLogs),
}));

export const progressLogsRelations = relations(progressLogs, ({ one }) => ({
  enterprise: one(enterprises, { fields: [progressLogs.enterprise_id], references: [enterprises.id] }),
  workOrder: one(workOrders, {
    fields: [progressLogs.enterprise_id, progressLogs.work_order_id],
    references: [workOrders.enterprise_id, workOrders.id],
  }),
}));

export const wageRulesRelations = relations(wageRules, ({ one, many }) => ({
  enterprise: one(enterprises, { fields: [wageRules.enterprise_id], references: [enterprises.id] }),
  worker: one(workers, {
    fields: [wageRules.enterprise_id, wageRules.worker_id],
    references: [workers.enterprise_id, workers.id],
  }),
  position: one(positions, {
    fields: [wageRules.enterprise_id, wageRules.position_id],
    references: [positions.enterprise_id, positions.id],
  }),
  records: many(workerWageRecords),
}));

export const workerWageRecordsRelations = relations(workerWageRecords, ({ one }) => ({
  enterprise: one(enterprises, { fields: [workerWageRecords.enterprise_id], references: [enterprises.id] }),
  worker: one(workers, {
    fields: [workerWageRecords.enterprise_id, workerWageRecords.worker_id],
    references: [workers.enterprise_id, workers.id],
  }),
  task: one(productionTasks, {
    fields: [workerWageRecords.enterprise_id, workerWageRecords.task_id],
    references: [productionTasks.enterprise_id, productionTasks.id],
  }),
  rule: one(wageRules, {
    fields: [workerWageRecords.enterprise_id, workerWageRecords.wage_rule_id],
    references: [wageRules.enterprise_id, wageRules.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  enterprise: one(enterprises, { fields: [tasks.enterprise_id], references: [enterprises.id] }),
  category: one(categories, {
    fields: [tasks.enterprise_id, tasks.category_id],
    references: [categories.enterprise_id, categories.id],
  }),
  notifications: many(notifications),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  enterprise: one(enterprises, { fields: [categories.enterprise_id], references: [enterprises.id] }),
  tasks: many(tasks),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  enterprise: one(enterprises, { fields: [notifications.enterprise_id], references: [enterprises.id] }),
  task: one(tasks, {
    fields: [notifications.enterprise_id, notifications.task_id],
    references: [tasks.enterprise_id, tasks.id],
  }),
}));

export const orderPrefixesRelations = relations(orderPrefixes, ({ one }) => ({
  enterprise: one(enterprises, { fields: [orderPrefixes.enterprise_id], references: [enterprises.id] }),
}));
export const orderExchangesRelations = relations(orderExchanges, ({ one }) => ({
  enterprise: one(enterprises, {
    fields: [orderExchanges.enterprise_id], references: [enterprises.id], relationName: 'exchangeEnterprise',
  }),
}));
export const factoryWorkshopsRelations = relations(factoryWorkshops, ({ one }) => ({
  enterprise: one(enterprises, { fields: [factoryWorkshops.enterprise_id], references: [enterprises.id] }),
}));
export const orderStatusLogsRelations = relations(orderStatusLogs, ({ one }) => ({
  enterprise: one(enterprises, { fields: [orderStatusLogs.enterprise_id], references: [enterprises.id] }),
}));
export const suppliersRelations = relations(suppliers, ({ one }) => ({
  enterprise: one(enterprises, { fields: [suppliers.enterprise_id], references: [enterprises.id] }),
}));
export const dealersRelations = relations(dealers, ({ one }) => ({
  enterprise: one(enterprises, { fields: [dealers.enterprise_id], references: [enterprises.id] }),
}));
export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  enterprise: one(enterprises, { fields: [userSettings.enterprise_id], references: [enterprises.id] }),
}));
export const enterpriseJoinRequestsRelations = relations(enterpriseJoinRequests, ({ one }) => ({
  enterprise: one(enterprises, { fields: [enterpriseJoinRequests.enterprise_id], references: [enterprises.id] }),
}));
