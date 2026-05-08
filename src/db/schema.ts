import { pgTable, serial, varchar, timestamp, boolean, integer, text, index, jsonb, uuid } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { createSchemaFactory } from "drizzle-zod"
import { z } from "zod"

// ============================================================================
// 系统表 - 禁止删除
// ============================================================================

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// ============================================================================
// 用户与租户
// ============================================================================

export const users = pgTable("users", {
	id: uuid("id").primaryKey().defaultRandom(),
	phone: varchar("phone", { length: 20 }).notNull().unique(),
	password: varchar("password", { length: 255 }).notNull(),
	nickname: varchar("nickname", { length: 100 }),
	avatar_url: varchar("avatar_url", { length: 512 }),
	role: varchar("role", { length: 50 }).notNull().default("user"),
	tenant_id: uuid("tenant_id"),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
});

export const tenants = pgTable("tenants", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: varchar("name", { length: 200 }).notNull(),
	type: varchar("type", { length: 50 }).notNull(),
	contact_person: varchar("contact_person", { length: 100 }),
	contact_phone: varchar("contact_phone", { length: 20 }),
	address: text("address"),
	status: varchar("status", { length: 20 }).notNull().default("active"),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
});

export const tenantUsers = pgTable("tenant_users", {
	id: uuid("id").primaryKey().defaultRandom(),
	tenant_id: uuid("tenant_id").notNull(),
	user_id: uuid("user_id").notNull(),
	role: varchar("role", { length: 50 }).notNull().default("member"),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// 订单与客户
// ============================================================================

export const customers = pgTable("customers", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: varchar("name", { length: 200 }).notNull(),
	phone: varchar("phone", { length: 20 }),
	address: text("address"),
	source: varchar("source", { length: 50 }),
	tenant_id: uuid("tenant_id"),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
});

export const orders = pgTable("orders", {
	id: uuid("id").primaryKey().defaultRandom(),
	order_no: varchar("order_no", { length: 50 }).notNull().unique(),
	customer_name: varchar("customer_name", { length: 200 }).notNull(),
	customer_phone: varchar("customer_phone", { length: 20 }),
	status: varchar("status", { length: 30 }).notNull().default("pending"),
	total_amount: integer("total_amount").default(0),
	tenant_id: uuid("tenant_id"),
	target_factory_id: uuid("target_factory_id"),
	delivery_date: timestamp("delivery_date", { withTimezone: true }),
	remark: text("remark"),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
});

export const orderItems = pgTable("order_items", {
	id: uuid("id").primaryKey().defaultRandom(),
	order_id: uuid("order_id").notNull(),
	product_name: varchar("product_name", { length: 200 }).notNull(),
	specifications: text("specifications"),
	quantity: integer("quantity").notNull().default(1),
	unit_price: integer("unit_price").default(0),
	unit: varchar("unit", { length: 20 }).default("件"),
	remark: text("remark"),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orderPrefixes = pgTable("order_prefixes", {
	id: uuid("id").primaryKey().defaultRandom(),
	prefix: varchar("prefix", { length: 10 }).notNull(),
	name: varchar("name", { length: 100 }).notNull(),
	tenant_id: uuid("tenant_id"),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// 生产与车间
// ============================================================================

export const workshops = pgTable("workshops", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: varchar("name", { length: 100 }).notNull(),
	code: varchar("code", { length: 20 }),
	tenant_id: uuid("tenant_id"),
	status: varchar("status", { length: 20 }).notNull().default("active"),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
});

export const productionTasks = pgTable("production_tasks", {
	id: uuid("id").primaryKey().defaultRandom(),
	order_id: uuid("order_id").notNull(),
	product_name: varchar("product_name", { length: 200 }).notNull(),
	quantity: integer("quantity").notNull(),
	completed: integer("completed").notNull().default(0),
	status: varchar("status", { length: 30 }).notNull().default("pending"),
	workshop_id: uuid("workshop_id"),
	tenant_id: uuid("tenant_id"),
	start_date: timestamp("start_date", { withTimezone: true }),
	end_date: timestamp("end_date", { withTimezone: true }),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
});

// ============================================================================
// 生产进度跟踪 (工单与进度日志)
// ============================================================================

export const workOrders = pgTable(
	"work_orders",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		order_id: uuid("order_id"),
		factory_id: uuid("factory_id"),
		workshop_id: uuid("workshop_id"),
		product_name: varchar("product_name", { length: 200 }).notNull(),
		target_quantity: integer("target_quantity").notNull(),
		completed_quantity: integer("completed_quantity").notNull().default(0),
		status: varchar("status", { length: 30 }).notNull().default("pending"),
		priority: varchar("priority", { length: 20 }).notNull().default("normal"),
		start_date: timestamp("start_date", { withTimezone: true }),
		expected_end_date: timestamp("expected_end_date", { withTimezone: true }),
		actual_end_date: timestamp("actual_end_date", { withTimezone: true }),
		tenant_id: uuid("tenant_id"),
		remark: text("remark"),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("work_orders_status_idx").on(table.status),
		index("work_orders_factory_id_idx").on(table.factory_id),
		index("work_orders_tenant_id_idx").on(table.tenant_id),
	]
);

export const progressLogs = pgTable(
	"progress_logs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		work_order_id: uuid("work_order_id").notNull(),
		operator_id: uuid("operator_id"),
		action: varchar("action", { length: 50 }).notNull(),
		remark: text("remark"),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("progress_logs_work_order_id_idx").on(table.work_order_id),
		index("progress_logs_created_at_idx").on(table.created_at),
	]
);

// ============================================================================
// 任务管理 & 通知
// ============================================================================

export const categories = pgTable(
	"categories",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		name: varchar("name", { length: 128 }).notNull(),
		color: varchar("color", { length: 7 }).notNull().default("#6366f1"),
		description: text("description"),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("categories_name_idx").on(table.name),
	]
);

export const tasks = pgTable(
	"tasks",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		title: varchar("title", { length: 255 }).notNull(),
		description: text("description"),
		status: varchar("status", { length: 20 }).notNull().default("pending"),
		priority: integer("priority").notNull().default(0),
		category_id: varchar("category_id", { length: 36 }).references(() => categories.id, { onDelete: "cascade" }),
		assignee_id: varchar("assignee_id", { length: 36 }),
		assignee_name: varchar("assignee_name", { length: 128 }),
		assignee_avatar: varchar("assignee_avatar", { length: 512 }),
		due_date: timestamp("due_date", { withTimezone: true }),
		completed: boolean("completed").default(false).notNull(),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("tasks_category_id_idx").on(table.category_id),
		index("tasks_status_idx").on(table.status),
		index("tasks_completed_idx").on(table.completed),
		index("tasks_created_at_idx").on(table.created_at),
		index("tasks_assignee_id_idx").on(table.assignee_id),
		index("tasks_priority_idx").on(table.priority),
		index("tasks_due_date_idx").on(table.due_date),
	]
);

export const notifications = pgTable(
	"notifications",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		task_id: varchar("task_id", { length: 36 }).references(() => tasks.id, { onDelete: "cascade" }),
		type: varchar("type", { length: 30 }).notNull().default("assignment"),
		title: varchar("title", { length: 255 }).notNull(),
		message: text("message"),
		read: boolean("read").default(false).notNull(),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("notifications_task_id_idx").on(table.task_id),
		index("notifications_type_idx").on(table.type),
		index("notifications_read_idx").on(table.read),
		index("notifications_created_at_idx").on(table.created_at),
	]
);

export const userSettings = pgTable("user_settings", {
	id: uuid("id").primaryKey().defaultRandom(),
	user_id: uuid("user_id").notNull(),
	key: varchar("key", { length: 100 }).notNull(),
	value: jsonb("value"),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
});

// ============================================================================
// Zod schemas for validation
// ============================================================================

const { createInsertSchema: createCoercedInsertSchema } = createSchemaFactory({ coerce: { date: true } });

export const insertCategorySchema = createCoercedInsertSchema(categories).pick({
	name: true,
	color: true,
	description: true,
});

export const insertTaskSchema = createCoercedInsertSchema(tasks).pick({
	title: true,
	description: true,
	status: true,
	priority: true,
	category_id: true,
	assignee_id: true,
	assignee_name: true,
	assignee_avatar: true,
	completed: true,
});

export const insertNotificationSchema = createCoercedInsertSchema(notifications).pick({
	task_id: true,
	type: true,
	title: true,
	message: true,
});

// ============================================================================
// Type exports
// ============================================================================

export type User = typeof users.$inferSelect;
export type Tenant = typeof tenants.$inferSelect;
export type TenantUser = typeof tenantUsers.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Workshop = typeof workshops.$inferSelect;
export type ProductionTask = typeof productionTasks.$inferSelect;
export type WorkOrder = typeof workOrders.$inferSelect;
export type ProgressLog = typeof progressLogs.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Notification = typeof notifications.$inferSelect;

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
