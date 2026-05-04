	// 使用 uuid 类型，让数据库自动生成 ID
	import { pgTable, index, unique, pgPolicy, varchar, text, boolean, timestamp, serial, foreignKey, integer, jsonb, check, uuid } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const profiles = pgTable("profiles", {
	id: uuid("id").primaryKey().defaultRandom(),
	phone: varchar({ length: 20 }).notNull(),
	nickname: varchar({ length: 100 }),
	avatar: text(),
	role: varchar({ length: 20 }).default('user').notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("profiles_phone_idx").using("btree", table.phone.asc().nullsLast().op("text_ops")),
	index("profiles_role_idx").using("btree", table.role.asc().nullsLast().op("text_ops")),
	unique("profiles_phone_key").on(table.phone),
	pgPolicy("profiles_all", { as: "permissive", for: "all", to: ["public"], using: sql`(( SELECT auth.role() AS role) = 'authenticated'::text)` }),
]);

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const customers = pgTable("customers", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	name: varchar({ length: 200 }).notNull(),
	contactPerson: varchar("contact_person", { length: 100 }),
	phone: varchar({ length: 20 }),
	address: text(),
	remark: text(),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("customers_name_idx").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("customers_phone_idx").using("btree", table.phone.asc().nullsLast().op("text_ops")),
	pgPolicy("customers_all", { as: "permissive", for: "all", to: ["public"], using: sql`(( SELECT auth.role() AS role) = 'authenticated'::text)` }),
]);

export const orders = pgTable("orders", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	orderNo: varchar("order_no", { length: 50 }).notNull(),
	customerId: varchar("customer_id", { length: 36 }),
	customerName: varchar("customer_name", { length: 200 }),
	status: varchar({ length: 20 }).default('pending').notNull(),
	totalAmount: integer("total_amount").default(0),
	deliveryDate: timestamp("delivery_date", { withTimezone: true, mode: 'string' }),
	remark: text(),
	receivedAt: timestamp("received_at", { withTimezone: true, mode: 'string' }),
	receivedBy: varchar("received_by", { length: 36 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("orders_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("orders_customer_id_idx").using("btree", table.customerId.asc().nullsLast().op("text_ops")),
	index("orders_delivery_date_idx").using("btree", table.deliveryDate.asc().nullsLast().op("timestamptz_ops")),
	index("orders_order_no_idx").using("btree", table.orderNo.asc().nullsLast().op("text_ops")),
	index("orders_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "orders_customer_id_fkey"
		}),
	unique("orders_order_no_key").on(table.orderNo),
	pgPolicy("orders_all", { as: "permissive", for: "all", to: ["public"], using: sql`(( SELECT auth.role() AS role) = 'authenticated'::text)` }),
]);

export const workshops = pgTable("workshops", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	code: varchar({ length: 20 }).notNull(),
	location: varchar({ length: 200 }),
	managerId: varchar("manager_id", { length: 36 }),
	status: varchar({ length: 20 }).default('active'),
	remark: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("workshops_code_idx").using("btree", table.code.asc().nullsLast().op("text_ops")),
	index("workshops_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	unique("workshops_code_key").on(table.code),
	pgPolicy("workshops_all", { as: "permissive", for: "all", to: ["public"], using: sql`(( SELECT auth.role() AS role) = 'authenticated'::text)` }),
]);

export const orderItems = pgTable("order_items", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	orderId: varchar("order_id", { length: 36 }).notNull(),
	productName: varchar("product_name", { length: 200 }).notNull(),
	specification: varchar({ length: 500 }),
	quantity: integer().default(1).notNull(),
	unit: varchar({ length: 20 }).default('件'),
	unitPrice: integer("unit_price").default(0),
	subtotal: integer().default(0),
	workshopId: varchar("workshop_id", { length: 36 }),
	productionStatus: varchar("production_status", { length: 20 }).default('pending'),
	completedQuantity: integer("completed_quantity").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("order_items_order_id_idx").using("btree", table.orderId.asc().nullsLast().op("text_ops")),
	index("order_items_production_status_idx").using("btree", table.productionStatus.asc().nullsLast().op("text_ops")),
	index("order_items_workshop_id_idx").using("btree", table.workshopId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "order_items_order_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.workshopId],
			foreignColumns: [workshops.id],
			name: "order_items_workshop_id_fkey"
		}),
	pgPolicy("order_items_all", { as: "permissive", for: "all", to: ["public"], using: sql`(( SELECT auth.role() AS role) = 'authenticated'::text)` }),
]);

export const tasks = pgTable("tasks", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	title: varchar({ length: 200 }).notNull(),
	orderItemId: varchar("order_item_id", { length: 36 }),
	workshopId: varchar("workshop_id", { length: 36 }),
	assignedTo: varchar("assigned_to", { length: 36 }),
	assignedBy: varchar("assigned_by", { length: 36 }),
	priority: varchar({ length: 10 }).default('normal'),
	status: varchar({ length: 20 }).default('pending'),
	dueDate: timestamp("due_date", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	remark: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("tasks_assigned_to_idx").using("btree", table.assignedTo.asc().nullsLast().op("text_ops")),
	index("tasks_due_date_idx").using("btree", table.dueDate.asc().nullsLast().op("timestamptz_ops")),
	index("tasks_order_item_id_idx").using("btree", table.orderItemId.asc().nullsLast().op("text_ops")),
	index("tasks_priority_idx").using("btree", table.priority.asc().nullsLast().op("text_ops")),
	index("tasks_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("tasks_workshop_id_idx").using("btree", table.workshopId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.orderItemId],
			foreignColumns: [orderItems.id],
			name: "tasks_order_item_id_fkey"
		}),
	foreignKey({
			columns: [table.workshopId],
			foreignColumns: [workshops.id],
			name: "tasks_workshop_id_fkey"
		}),
	pgPolicy("tasks_all", { as: "permissive", for: "all", to: ["public"], using: sql`(( SELECT auth.role() AS role) = 'authenticated'::text)` }),
]);

export const productionProgress = pgTable("production_progress", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	orderItemId: varchar("order_item_id", { length: 36 }).notNull(),
	workshopId: varchar("workshop_id", { length: 36 }),
	progress: integer().default(0).notNull(),
	stage: varchar({ length: 50 }),
	description: text(),
	operatorId: varchar("operator_id", { length: 36 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("production_progress_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("production_progress_order_item_id_idx").using("btree", table.orderItemId.asc().nullsLast().op("text_ops")),
	index("production_progress_workshop_id_idx").using("btree", table.workshopId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.orderItemId],
			foreignColumns: [orderItems.id],
			name: "production_progress_order_item_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.workshopId],
			foreignColumns: [workshops.id],
			name: "production_progress_workshop_id_fkey"
		}),
	pgPolicy("production_progress_all", { as: "permissive", for: "all", to: ["public"], using: sql`(( SELECT auth.role() AS role) = 'authenticated'::text)` }),
]);

export const shipping = pgTable("shipping", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	shippingNo: varchar("shipping_no", { length: 50 }).notNull(),
	orderId: varchar("order_id", { length: 36 }),
	customerId: varchar("customer_id", { length: 36 }),
	receiverName: varchar("receiver_name", { length: 100 }),
	receiverPhone: varchar("receiver_phone", { length: 20 }),
	receiverAddress: text("receiver_address"),
	logisticsCompany: varchar("logistics_company", { length: 100 }),
	trackingNo: varchar("tracking_no", { length: 100 }),
	status: varchar({ length: 20 }).default('pending'),
	shippedAt: timestamp("shipped_at", { withTimezone: true, mode: 'string' }),
	deliveredAt: timestamp("delivered_at", { withTimezone: true, mode: 'string' }),
	remark: text(),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("shipping_customer_id_idx").using("btree", table.customerId.asc().nullsLast().op("text_ops")),
	index("shipping_order_id_idx").using("btree", table.orderId.asc().nullsLast().op("text_ops")),
	index("shipping_shipping_no_idx").using("btree", table.shippingNo.asc().nullsLast().op("text_ops")),
	index("shipping_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("shipping_tracking_no_idx").using("btree", table.trackingNo.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "shipping_order_id_fkey"
		}),
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "shipping_customer_id_fkey"
		}),
	unique("shipping_shipping_no_key").on(table.shippingNo),
	pgPolicy("shipping_all", { as: "permissive", for: "all", to: ["public"], using: sql`(( SELECT auth.role() AS role) = 'authenticated'::text)` }),
]);

export const operationLogs = pgTable("operation_logs", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	operatorId: varchar("operator_id", { length: 36 }),
	action: varchar({ length: 50 }).notNull(),
	entityType: varchar("entity_type", { length: 50 }),
	entityId: varchar("entity_id", { length: 36 }),
	detail: jsonb(),
	ipAddress: varchar("ip_address", { length: 50 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("operation_logs_action_idx").using("btree", table.action.asc().nullsLast().op("text_ops")),
	index("operation_logs_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("operation_logs_entity_type_idx").using("btree", table.entityType.asc().nullsLast().op("text_ops")),
	index("operation_logs_operator_id_idx").using("btree", table.operatorId.asc().nullsLast().op("text_ops")),
	pgPolicy("operation_logs_all", { as: "permissive", for: "all", to: ["public"], using: sql`(( SELECT auth.role() AS role) = 'authenticated'::text)` }),
]);

export const smsCodes = pgTable("sms_codes", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	phone: varchar({ length: 20 }).notNull(),
	code: varchar({ length: 10 }).notNull(),
	type: varchar({ length: 20 }).default('register'),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	used: boolean().default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("sms_codes_expires_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")),
	index("sms_codes_phone_idx").using("btree", table.phone.asc().nullsLast().op("text_ops")),
]);

export const users = pgTable("users", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	phone: varchar({ length: 20 }).notNull(),
	password: varchar({ length: 255 }).notNull(),
	nickname: varchar({ length: 100 }),
	role: varchar({ length: 20 }).default('user'),
	isActive: boolean("is_active").default(true),
	lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	tenantType: varchar("tenant_type", { length: 20 }),
	tenantId: uuid("tenant_id"),
}, (table) => [
	index("users_phone_idx").using("btree", table.phone.asc().nullsLast().op("text_ops")),
	index("users_role_idx").using("btree", table.role.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "users_tenant_id_fkey"
		}).onDelete("set null"),
	unique("users_phone_key").on(table.phone),
	pgPolicy("users_all", { as: "permissive", for: "all", to: ["public"], using: sql`(( SELECT auth.role() AS role) = 'authenticated'::text)` }),
	check("users_tenant_type_check", sql`(tenant_type)::text = ANY ((ARRAY['official'::character varying, 'manufacturer'::character varying, 'dealer'::character varying, 'material_supplier'::character varying])::text[])`),
]);

export const userSettings = pgTable("user_settings", {
	id: varchar({ length: 100 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id", { length: 100 }).notNull(),
	settingKey: varchar("setting_key", { length: 100 }).notNull(),
	settingValue: text("setting_value"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("user_settings_key_idx").using("btree", table.settingKey.asc().nullsLast().op("text_ops")),
	index("user_settings_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	unique("user_settings_user_id_setting_key_key").on(table.userId, table.settingKey),
	pgPolicy("Allow all access to user_settings", { as: "permissive", for: "all", to: ["public"], using: sql`true`, withCheck: sql`true`  }),
]);

export const tenants = pgTable("tenants", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantType: varchar("tenant_type", { length: 20 }).notNull(),
	companyName: varchar("company_name", { length: 100 }).notNull(),
	contactPhone: varchar("contact_phone", { length: 20 }),
	address: text(),
	prefix: varchar({ length: 20 }),
	status: varchar({ length: 20 }).default('active'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("tenants_prefix_key").on(table.prefix),
	check("tenants_tenant_type_check", sql`(tenant_type)::text = ANY ((ARRAY['manufacturer'::character varying, 'dealer'::character varying, 'material_supplier'::character varying])::text[])`),
]);

export const orderPrefixes = pgTable("order_prefixes", {
	id: uuid().defaultRandom(),
	prefix: varchar({ length: 20 }).notNull(),
	companyName: varchar("company_name", { length: 100 }),
	phone: varchar({ length: 20 }),
	address: text(),
	createdBy: varchar("created_by", { length: 100 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("order_prefixes_prefix_key").on(table.prefix),
]);

export const tenantUsers = pgTable("tenant_users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	phone: varchar({ length: 20 }).notNull(),
	password: varchar({ length: 255 }).notNull(),
	name: varchar({ length: 100 }),
	role: varchar({ length: 50 }).notNull(),
	department: varchar({ length: 50 }),
	status: varchar({ length: 20 }).default('active'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "tenant_users_tenant_id_fkey"
		}).onDelete("cascade"),
	unique("tenant_users_tenant_id_phone_key").on(table.tenantId, table.phone),
]);
