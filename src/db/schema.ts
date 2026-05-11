import { pgTable, serial, varchar, timestamp, boolean, integer, text, index, jsonb, uuid, numeric, date } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

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
	real_name: varchar("real_name", { length: 100 }),
	nickname: varchar("nickname", { length: 100 }),
	avatar_url: varchar("avatar_url", { length: 512 }),
	role: varchar("role", { length: 50 }).notNull().default("user"),
	tenant_id: uuid("tenant_id"),
	tenant_type: varchar("tenant_type", { length: 50 }),
	is_active: boolean("is_active").default(true).notNull(),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
});

export const tenants = pgTable("tenants", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: varchar("name", { length: 200 }).notNull(),
	tenant_type: varchar("tenant_type", { length: 50 }).notNull(),
	company_name: varchar("company_name", { length: 200 }),
	contact_person: varchar("contact_person", { length: 100 }),
	contact_phone: varchar("contact_phone", { length: 20 }),
	prefix: varchar("prefix", { length: 10 }),
	address: text("address"),
	status: varchar("status", { length: 20 }).notNull().default("active"),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
});

export const tenantUsers = pgTable("tenant_users", {
	id: uuid("id").primaryKey().defaultRandom(),
	tenant_id: uuid("tenant_id").notNull(),
	user_id: uuid("user_id").notNull(),
	phone: varchar("phone", { length: 20 }).notNull(),
	password: varchar("password", { length: 255 }).notNull(),
	name: varchar("name", { length: 100 }),
	role: varchar("role", { length: 50 }).notNull().default("member"),
	department: varchar("department", { length: 100 }),
	status: varchar("status", { length: 20 }).notNull().default("active"),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
});

export const userPermissions = pgTable(
	"user_permissions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		user_id: uuid("user_id").notNull(),
		tenant_id: uuid("tenant_id"),
		permission_key: varchar("permission_key", { length: 80 }).notNull(),
		assigned_by: uuid("assigned_by"),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("user_permissions_user_id_idx").on(table.user_id),
		index("user_permissions_tenant_id_idx").on(table.tenant_id),
		index("user_permissions_permission_key_idx").on(table.permission_key),
	]
);

// ============================================================================
// 订单与客户
// ============================================================================

export const customers = pgTable("customers", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: varchar("name", { length: 200 }).notNull(),
	phone: varchar("phone", { length: 20 }),
	address: text("address"),
	source: varchar("source", { length: 50 }),
	status: varchar("status", { length: 20 }).default("active"),
	tenant_id: uuid("tenant_id"),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
});

export const orders = pgTable(
	"orders",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		order_no: varchar("order_no", { length: 50 }).notNull().unique(),
		customer_name: varchar("customer_name", { length: 200 }).notNull(),
		customer_phone: varchar("customer_phone", { length: 20 }),
		customer_address: text("customer_address"),
		status: varchar("status", { length: 50 }).notNull().default("pending"),
		total_amount: numeric("total_amount", { precision: 12, scale: 2 }).default("0"),
		deposit_amount: numeric("deposit_amount", { precision: 12, scale: 2 }).default("0"),
		tenant_id: uuid("tenant_id"),
		target_factory_id: uuid("target_factory_id"),
		dealer_id: uuid("dealer_id"),
		delivery_date: date("delivery_date"),
		remark: text("remark"),
		created_by: uuid("created_by"),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("orders_tenant_id_idx").on(table.tenant_id),
		index("orders_status_idx").on(table.status),
		index("orders_created_by_idx").on(table.created_by),
	]
);

export const orderItems = pgTable(
	"order_items",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		order_id: uuid("order_id").notNull(),
		product_name: varchar("product_name", { length: 200 }).notNull(),
		specifications: text("specifications"),
		quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
		unit: varchar("unit", { length: 20 }).default("件"),
		unit_price: numeric("unit_price", { precision: 12, scale: 2 }).default("0"),
		subtotal: numeric("subtotal", { precision: 12, scale: 2 }).default("0"),
		remark: text("remark"),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("order_items_order_id_idx").on(table.order_id),
	]
);

export const orderPrefixes = pgTable("order_prefixes", {
	id: uuid("id").primaryKey().defaultRandom(),
	prefix: varchar("prefix", { length: 10 }).notNull().unique(),
	name: varchar("name", { length: 100 }).notNull(),
	company_name: varchar("company_name", { length: 200 }),
	phone: varchar("phone", { length: 20 }),
	address: text("address"),
	current_val: integer("current_val").default(0),
	tenant_id: uuid("tenant_id"),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orderExchanges = pgTable(
	"order_exchanges",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		order_id: uuid("order_id").notNull(),
		from_tenant_id: uuid("from_tenant_id").notNull(),
		to_tenant_id: uuid("to_tenant_id").notNull(),
		from_user_id: uuid("from_user_id").notNull(),
		status: varchar("status", { length: 40 }).notNull().default("sent"),
		message: text("message"),
		proposed_changes: jsonb("proposed_changes"),
		handled_by: uuid("handled_by"),
		handled_at: timestamp("handled_at", { withTimezone: true }),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("order_exchanges_order_id_idx").on(table.order_id),
		index("order_exchanges_from_tenant_id_idx").on(table.from_tenant_id),
		index("order_exchanges_to_tenant_id_idx").on(table.to_tenant_id),
		index("order_exchanges_status_idx").on(table.status),
		index("order_exchanges_created_at_idx").on(table.created_at),
	]
);

// ============================================================================
// 生产与车间
// ============================================================================

export const workshops = pgTable("workshops", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: varchar("name", { length: 100 }).notNull(),
	code: varchar("code", { length: 20 }),
	description: text("description"),
	tenant_id: uuid("tenant_id"),
	status: varchar("status", { length: 20 }).notNull().default("active"),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
});

export const factoryWorkshops = pgTable(
	"factory_workshops",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: varchar("name", { length: 100 }).notNull(),
		factory_code: varchar("factory_code", { length: 20 }),
		manager: varchar("manager", { length: 100 }),
		location: varchar("location", { length: 200 }),
		capacity: integer("capacity").default(0),
		current_load: integer("current_load").default(0),
		status: varchar("status", { length: 20 }).notNull().default("normal"),
		description: text("description"),
		tenant_id: uuid("tenant_id"),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("factory_workshops_status_idx").on(table.status),
		index("factory_workshops_tenant_id_idx").on(table.tenant_id),
	]
);

export const productionTasks = pgTable(
	"production_tasks",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		order_id: uuid("order_id"),
		task_no: varchar("task_no", { length: 50 }),
		task_name: varchar("task_name", { length: 200 }),
		product_name: varchar("product_name", { length: 200 }).notNull(),
		quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
		unit: varchar("unit", { length: 20 }).default("件"),
		completed: integer("completed").notNull().default(0),
		status: varchar("status", { length: 30 }).notNull().default("pending"),
		priority: integer("priority").default(0),
		progress: varchar("progress", { length: 30 }).default("pending"),
		worker_id: uuid("worker_id"),
		assigned_to: uuid("assigned_to"),
		workshop_id: uuid("workshop_id"),
		tenant_id: uuid("tenant_id"),
		planned_start_date: date("planned_start_date"),
		planned_end_date: date("planned_end_date"),
		actual_start_date: date("actual_start_date"),
		actual_end_date: date("actual_end_date"),
		started_at: timestamp("started_at", { withTimezone: true }),
		completed_at: timestamp("completed_at", { withTimezone: true }),
		start_date: timestamp("start_date", { withTimezone: true }),
		end_date: timestamp("end_date", { withTimezone: true }),
		remark: text("remark"),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("production_tasks_order_id_idx").on(table.order_id),
		index("production_tasks_workshop_id_idx").on(table.workshop_id),
		index("production_tasks_tenant_id_idx").on(table.tenant_id),
		index("production_tasks_worker_id_idx").on(table.worker_id),
	]
);

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
		operator_name: varchar("operator_name", { length: 100 }),
		action: varchar("action", { length: 50 }).notNull(),
		completed_delta: integer("completed_delta").default(0),
		remark: text("remark"),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("progress_logs_work_order_id_idx").on(table.work_order_id),
		index("progress_logs_created_at_idx").on(table.created_at),
	]
);

// ============================================================================
// 工人管理
// ============================================================================

export const workers = pgTable(
	"workers",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		worker_no: varchar("worker_no", { length: 20 }).notNull().unique(),
		name: varchar("name", { length: 100 }).notNull(),
		phone: varchar("phone", { length: 20 }),
		gender: varchar("gender", { length: 10 }),
		craft_type: varchar("craft_type", { length: 50 }),
		workshop_id: uuid("workshop_id"),
		status: varchar("status", { length: 20 }).notNull().default("active"),
		skill_tags: jsonb("skill_tags"),
		hire_date: date("hire_date"),
		remark: text("remark"),
		created_by: uuid("created_by"),
		tenant_id: uuid("tenant_id"),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("workers_worker_no_idx").on(table.worker_no),
		index("workers_craft_type_idx").on(table.craft_type),
		index("workers_workshop_id_idx").on(table.workshop_id),
		index("workers_status_idx").on(table.status),
		index("workers_tenant_id_idx").on(table.tenant_id),
	]
);

// ============================================================================
// 供应商管理
// ============================================================================

export const suppliers = pgTable(
	"suppliers",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		supplier_code: varchar("supplier_code", { length: 20 }).notNull().unique(),
		name: varchar("name", { length: 200 }).notNull(),
		contact_person: varchar("contact_person", { length: 100 }),
		phone: varchar("phone", { length: 20 }),
		email: varchar("email", { length: 100 }),
		category: varchar("category", { length: 50 }),
		rating: varchar("rating", { length: 10 }).default("B"),
		status: varchar("status", { length: 20 }).notNull().default("active"),
		address: text("address"),
		remark: text("remark"),
		created_by: uuid("created_by"),
		tenant_id: uuid("tenant_id"),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("suppliers_supplier_code_idx").on(table.supplier_code),
		index("suppliers_category_idx").on(table.category),
		index("suppliers_status_idx").on(table.status),
		index("suppliers_tenant_id_idx").on(table.tenant_id),
	]
);

// ============================================================================
// 经销商管理
// ============================================================================

export const dealers = pgTable(
	"dealers",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: varchar("name", { length: 200 }).notNull(),
		contact_name: varchar("contact_name", { length: 100 }),
		phone: varchar("phone", { length: 20 }),
		region: varchar("region", { length: 100 }),
		status: varchar("status", { length: 20 }).notNull().default("active"),
		remark: text("remark"),
		created_by: uuid("created_by"),
		tenant_id: uuid("tenant_id"),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("dealers_status_idx").on(table.status),
		index("dealers_region_idx").on(table.region),
		index("dealers_tenant_id_idx").on(table.tenant_id),
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
// Type exports
// ============================================================================

export type User = typeof users.$inferSelect;
export type Tenant = typeof tenants.$inferSelect;
export type TenantUser = typeof tenantUsers.$inferSelect;
export type UserPermission = typeof userPermissions.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderPrefix = typeof orderPrefixes.$inferSelect;
export type OrderExchange = typeof orderExchanges.$inferSelect;
export type Workshop = typeof workshops.$inferSelect;
export type FactoryWorkshop = typeof factoryWorkshops.$inferSelect;
export type ProductionTask = typeof productionTasks.$inferSelect;
export type WorkOrder = typeof workOrders.$inferSelect;
export type ProgressLog = typeof progressLogs.$inferSelect;
export type Worker = typeof workers.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type Dealer = typeof dealers.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type UserSetting = typeof userSettings.$inferSelect;

// Insert types (partial, for create/update operations)
export type InsertCategory = Pick<Category, "name" | "color" | "description">;
export type InsertTask = Pick<Task, "title" | "description" | "status" | "priority" | "category_id" | "assignee_id" | "assignee_name" | "assignee_avatar" | "completed">;
export type InsertNotification = Pick<Notification, "task_id" | "type" | "title" | "message">;
