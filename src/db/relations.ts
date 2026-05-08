import { relations } from "drizzle-orm/relations";
import { users, tenants, tenantUsers, orders, orderItems, customers, workshops, productionTasks, workOrders, progressLogs, categories, tasks, notifications, userSettings, orderPrefixes } from "./schema";

// 用户 -> 租户
export const usersRelations = relations(users, ({ one }) => ({
	tenant: one(tenants, {
		fields: [users.tenant_id],
		references: [tenants.id],
	}),
}));

// 租户 -> 用户
export const tenantsRelations = relations(tenants, ({ many }) => ({
	users: many(tenantUsers),
	workshops: many(workshops),
	orders: many(orders),
}));

// 租户用户 -> 租户 & 用户
export const tenantUsersRelations = relations(tenantUsers, ({ one }) => ({
	tenant: one(tenants, {
		fields: [tenantUsers.tenant_id],
		references: [tenants.id],
	}),
	user: one(users, {
		fields: [tenantUsers.user_id],
		references: [users.id],
	}),
}));

// 订单 -> 订单项 & 客户
export const ordersRelations = relations(orders, ({ one, many }) => ({
	items: many(orderItems),
	tenant: one(tenants, {
		fields: [orders.tenant_id],
		references: [tenants.id],
	}),
	factory: one(tenants, {
		fields: [orders.target_factory_id],
		references: [tenants.id],
	}),
}));

// 订单项 -> 订单
export const orderItemsRelations = relations(orderItems, ({ one }) => ({
	order: one(orders, {
		fields: [orderItems.order_id],
		references: [orders.id],
	}),
}));

// 生产任务 -> 订单 & 车间
export const productionTasksRelations = relations(productionTasks, ({ one }) => ({
	order: one(orders, {
		fields: [productionTasks.order_id],
		references: [orders.id],
	}),
	workshop: one(workshops, {
		fields: [productionTasks.workshop_id],
		references: [workshops.id],
	}),
}));

// 工单 -> 进度日志
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
