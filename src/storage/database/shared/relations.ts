import { relations } from "drizzle-orm/relations";
import { customers, orders, orderItems, workshops, tasks, productionProgress, shipping, tenants, users, tenantUsers } from "./schema";

export const ordersRelations = relations(orders, ({one, many}) => ({
	customer: one(customers, {
		fields: [orders.customerId],
		references: [customers.id]
	}),
	orderItems: many(orderItems),
	shippings: many(shipping),
}));

export const customersRelations = relations(customers, ({many}) => ({
	orders: many(orders),
	shippings: many(shipping),
}));

export const orderItemsRelations = relations(orderItems, ({one, many}) => ({
	order: one(orders, {
		fields: [orderItems.orderId],
		references: [orders.id]
	}),
	workshop: one(workshops, {
		fields: [orderItems.workshopId],
		references: [workshops.id]
	}),
	tasks: many(tasks),
	productionProgresses: many(productionProgress),
}));

export const workshopsRelations = relations(workshops, ({many}) => ({
	orderItems: many(orderItems),
	tasks: many(tasks),
	productionProgresses: many(productionProgress),
}));

export const tasksRelations = relations(tasks, ({one}) => ({
	orderItem: one(orderItems, {
		fields: [tasks.orderItemId],
		references: [orderItems.id]
	}),
	workshop: one(workshops, {
		fields: [tasks.workshopId],
		references: [workshops.id]
	}),
}));

export const productionProgressRelations = relations(productionProgress, ({one}) => ({
	orderItem: one(orderItems, {
		fields: [productionProgress.orderItemId],
		references: [orderItems.id]
	}),
	workshop: one(workshops, {
		fields: [productionProgress.workshopId],
		references: [workshops.id]
	}),
}));

export const shippingRelations = relations(shipping, ({one}) => ({
	order: one(orders, {
		fields: [shipping.orderId],
		references: [orders.id]
	}),
	customer: one(customers, {
		fields: [shipping.customerId],
		references: [customers.id]
	}),
}));

export const usersRelations = relations(users, ({one}) => ({
	tenant: one(tenants, {
		fields: [users.tenantId],
		references: [tenants.id]
	}),
}));

export const tenantsRelations = relations(tenants, ({many}) => ({
	users: many(users),
	tenantUsers: many(tenantUsers),
}));

export const tenantUsersRelations = relations(tenantUsers, ({one}) => ({
	tenant: one(tenants, {
		fields: [tenantUsers.tenantId],
		references: [tenants.id]
	}),
}));