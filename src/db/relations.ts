import { relations } from 'drizzle-orm/relations';
import {
  users,
  tenants,
  tenantUsers,
  orders,
  orderSpaces,
  orderProducts,
  orderModules,
  orderItems,
  orderItemAttachments,
  workshops,
  factoryWorkshops,
  productionTasks,
  wageRules,
  workerWageRecords,
  orderStatusLogs,
  workOrders,
  progressLogs,
  workers,
  suppliers,
  dealers,
  categories,
  tasks,
  notifications,
} from './schema';

export const usersRelations = relations(users, ({ one }) => ({
  tenant: one(tenants, {
    fields: [users.tenant_id],
    references: [tenants.id],
  }),
}));

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(tenantUsers),
  workshops: many(workshops),
  orders: many(orders),
  suppliers: many(suppliers),
  workers: many(workers),
  dealers: many(dealers),
  factoryWorkshops: many(factoryWorkshops),
}));

export const tenantUsersRelations = relations(tenantUsers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantUsers.tenant_id],
    references: [tenants.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  items: many(orderItems),
  modules: many(orderModules),
  spaces: many(orderSpaces),
  products: many(orderProducts),
  productionTasks: many(productionTasks),
  tenant: one(tenants, {
    fields: [orders.tenant_id],
    references: [tenants.id],
  }),
  targetFactory: one(tenants, {
    fields: [orders.target_factory_id],
    references: [tenants.id],
    relationName: 'targetFactory',
  }),
  dealer: one(tenants, {
    fields: [orders.dealer_id],
    references: [tenants.id],
    relationName: 'orderDealer',
  }),
  fromTenant: one(tenants, {
    fields: [orders.from_tenant_id],
    references: [tenants.id],
    relationName: 'orderFromTenant',
  }),
  toTenant: one(tenants, {
    fields: [orders.to_tenant_id],
    references: [tenants.id],
    relationName: 'orderToTenant',
  }),
  parentOrder: one(orders, {
    fields: [orders.parent_order_id],
    references: [orders.id],
    relationName: 'parentOrder',
  }),
}));

export const orderSpacesRelations = relations(orderSpaces, ({ one, many }) => ({
  order: one(orders, {
    fields: [orderSpaces.order_id],
    references: [orders.id],
  }),
  products: many(orderProducts),
  productionTasks: many(productionTasks),
}));

export const orderProductsRelations = relations(orderProducts, ({ one, many }) => ({
  order: one(orders, {
    fields: [orderProducts.order_id],
    references: [orders.id],
  }),
  space: one(orderSpaces, {
    fields: [orderProducts.space_id],
    references: [orderSpaces.id],
  }),
  productionTasks: many(productionTasks),
}));

export const orderModulesRelations = relations(orderModules, ({ one, many }) => ({
  order: one(orders, {
    fields: [orderModules.order_id],
    references: [orders.id],
  }),
  items: many(orderItems),
  attachments: many(orderItemAttachments),
}));

export const orderItemsRelations = relations(orderItems, ({ one, many }) => ({
  order: one(orders, {
    fields: [orderItems.order_id],
    references: [orders.id],
  }),
  module: one(orderModules, {
    fields: [orderItems.module_id],
    references: [orderModules.id],
  }),
  attachments: many(orderItemAttachments),
}));

export const orderItemAttachmentsRelations = relations(orderItemAttachments, ({ one }) => ({
  order: one(orders, {
    fields: [orderItemAttachments.order_id],
    references: [orders.id],
  }),
  module: one(orderModules, {
    fields: [orderItemAttachments.module_id],
    references: [orderModules.id],
  }),
  item: one(orderItems, {
    fields: [orderItemAttachments.order_item_id],
    references: [orderItems.id],
  }),
}));

export const workshopsRelations = relations(workshops, ({ many }) => ({
  productionTasks: many(productionTasks),
  workers: many(workers),
}));

export const factoryWorkshopsRelations = relations(factoryWorkshops, ({ one }) => ({
  tenant: one(tenants, {
    fields: [factoryWorkshops.tenant_id],
    references: [tenants.id],
  }),
}));

export const productionTasksRelations = relations(productionTasks, ({ one }) => ({
  order: one(orders, {
    fields: [productionTasks.order_id],
    references: [orders.id],
  }),
  space: one(orderSpaces, {
    fields: [productionTasks.space_id],
    references: [orderSpaces.id],
  }),
  product: one(orderProducts, {
    fields: [productionTasks.product_id],
    references: [orderProducts.id],
  }),
  workshop: one(workshops, {
    fields: [productionTasks.workshop_id],
    references: [workshops.id],
  }),
  worker: one(workers, {
    fields: [productionTasks.worker_id],
    references: [workers.id],
  }),
  assignedWorker: one(workers, {
    fields: [productionTasks.assigned_worker_id],
    references: [workers.id],
    relationName: 'assignedProductionWorker',
  }),
  wageRule: one(wageRules, {
    fields: [productionTasks.wage_rule_id],
    references: [wageRules.id],
  }),
}));

export const wageRulesRelations = relations(wageRules, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [wageRules.tenant_id],
    references: [tenants.id],
  }),
  tasks: many(productionTasks),
  records: many(workerWageRecords),
}));

export const workerWageRecordsRelations = relations(workerWageRecords, ({ one }) => ({
  worker: one(workers, {
    fields: [workerWageRecords.worker_id],
    references: [workers.id],
  }),
  order: one(orders, {
    fields: [workerWageRecords.order_id],
    references: [orders.id],
  }),
  space: one(orderSpaces, {
    fields: [workerWageRecords.space_id],
    references: [orderSpaces.id],
  }),
  product: one(orderProducts, {
    fields: [workerWageRecords.product_id],
    references: [orderProducts.id],
  }),
  task: one(productionTasks, {
    fields: [workerWageRecords.task_id],
    references: [productionTasks.id],
  }),
  wageRule: one(wageRules, {
    fields: [workerWageRecords.wage_rule_id],
    references: [wageRules.id],
  }),
}));

export const orderStatusLogsRelations = relations(orderStatusLogs, ({ one }) => ({
  changedBy: one(users, {
    fields: [orderStatusLogs.changed_by],
    references: [users.id],
  }),
}));

export const workOrdersRelations = relations(workOrders, ({ one, many }) => ({
  progressLogs: many(progressLogs),
  factory: one(tenants, {
    fields: [workOrders.factory_id],
    references: [tenants.id],
  }),
  workshop: one(workshops, {
    fields: [workOrders.workshop_id],
    references: [workshops.id],
  }),
}));

export const progressLogsRelations = relations(progressLogs, ({ one }) => ({
  workOrder: one(workOrders, {
    fields: [progressLogs.work_order_id],
    references: [workOrders.id],
  }),
  operator: one(users, {
    fields: [progressLogs.operator_id],
    references: [users.id],
  }),
}));

export const workersRelations = relations(workers, ({ one }) => ({
  user: one(users, {
    fields: [workers.user_id],
    references: [users.id],
  }),
  workshop: one(workshops, {
    fields: [workers.workshop_id],
    references: [workshops.id],
  }),
}));

export const suppliersRelations = relations(suppliers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [suppliers.tenant_id],
    references: [tenants.id],
  }),
}));

export const dealersRelations = relations(dealers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [dealers.tenant_id],
    references: [tenants.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  category: one(categories, {
    fields: [tasks.category_id],
    references: [categories.id],
  }),
  notifications: many(notifications),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  task: one(tasks, {
    fields: [notifications.task_id],
    references: [tasks.id],
  }),
}));
