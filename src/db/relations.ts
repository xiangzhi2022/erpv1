import { relations } from "drizzle-orm/relations";
import {
	users, tenants, tenantUsers, orders, orderItems,
	workshops, factoryWorkshops, productionTasks, workOrders, progressLogs,
	workers, suppliers, dealers,
	categories, tasks, notifications,
} from "./schema";

// ============================================================================
// 用户与租户
// ============================================================================

// 用户 -> 租户
export const usersRelations = relations(users, ({ one }) => ({
	tenant: one(tenants, {
		fields: [users.tenant_id],
		references: [tenants.id],
	}),
}));

// 租户 -> 用户 & 车间 & 订单 & 供应商 & 工人 & 经销商
export const tenantsRelations = relations(tenants, ({ many }) => ({
	users: many(tenantUsers),
	workshops: many(workshops),
	orders: many(orders),
	suppliers: many(suppliers),
	workers: many(workers),
	dealers: many(dealers),
	factoryWorkshops: many(factoryWorkshops),
}));

// 租户用户 -> 租户
export const tenantUsersRelations = relations(tenantUsers, ({ one }) => ({
	tenant: one(tenants, {
		fields: [tenantUsers.tenant_id],
		references: [tenants.id],
	}),
}));

// ============================================================================
// 订单与客户
// ============================================================================

// 订单 -> 订单项 & 租户 & 目标工厂 & 经销商
export const ordersRelations = relations(orders, ({ one, many }) => ({
	items: many(orderItems),
	tenant: one(tenants, {
		fields: [orders.tenant_id],
		references: [tenants.id],
	}),
	targetFactory: one(tenants, {
		fields: [orders.target_factory_id],
		references: [tenants.id],
		relationName: "targetFactory",
	}),
	dealer: one(tenants, {
		fields: [orders.dealer_id],
		references: [tenants.id],
		relationName: "orderDealer",
	}),
}));

// 订单项 -> 订单
export const orderItemsRelations = relations(orderItems, ({ one }) => ({
	order: one(orders, {
		fields: [orderItems.order_id],
		references: [orders.id],
	}),
}));

// ============================================================================
// 生产与车间
// ============================================================================

// 车间 (workshops) -> 生产任务
export const workshopsRelations = relations(workshops, ({ many }) => ({
	productionTasks: many(productionTasks),
	workers: many(workers),
}));

// 工厂车间 (factory_workshops) -> 租户
export const factoryWorkshopsRelations = relations(factoryWorkshops, ({ one }) => ({
	tenant: one(tenants, {
		fields: [factoryWorkshops.tenant_id],
		references: [tenants.id],
	}),
}));

// 生产任务 -> 订单 & 车间 & 工人
export const productionTasksRelations = relations(productionTasks, ({ one }) => ({
	order: one(orders, {
		fields: [productionTasks.order_id],
		references: [orders.id],
	}),
	workshop: one(workshops, {
		fields: [productionTasks.workshop_id],
		references: [workshops.id],
	}),
	worker: one(workers, {
		fields: [productionTasks.worker_id],
		references: [workers.id],
	}),
}));

// ============================================================================
// 生产进度跟踪
// ============================================================================

// 工单 -> 进度日志 & 工厂 & 车间
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

// 进度日志 -> 工单 & 操作人
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

// ============================================================================
// 工人管理
// ============================================================================

// 工人 -> 车间
export const workersRelations = relations(workers, ({ one }) => ({
	workshop: one(workshops, {
		fields: [workers.workshop_id],
		references: [workshops.id],
	}),
}));

// ============================================================================
// 供应商管理
// ============================================================================

// 供应商 -> 租户
export const suppliersRelations = relations(suppliers, ({ one }) => ({
	tenant: one(tenants, {
		fields: [suppliers.tenant_id],
		references: [tenants.id],
	}),
}));

// ============================================================================
// 经销商管理
// ============================================================================

// 经销商 -> 租户
export const dealersRelations = relations(dealers, ({ one }) => ({
	tenant: one(tenants, {
		fields: [dealers.tenant_id],
		references: [tenants.id],
	}),
}));

// ============================================================================
// 任务管理 & 通知
// ============================================================================

// 任务 -> 分类 & 通知
export const tasksRelations = relations(tasks, ({ one, many }) => ({
	category: one(categories, {
		fields: [tasks.category_id],
		references: [categories.id],
	}),
	notifications: many(notifications),
}));

// 通知 -> 任务
export const notificationsRelations = relations(notifications, ({ one }) => ({
	task: one(tasks, {
		fields: [notifications.task_id],
		references: [tasks.id],
	}),
}));
