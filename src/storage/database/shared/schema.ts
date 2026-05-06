import { pgTable, serial, timestamp, index, unique, pgPolicy, uuid, varchar, boolean, text } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
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
	unique("users_phone_key").on(table.phone),
	pgPolicy("users_all", { as: "permissive", for: "all", to: ["public"], using: sql`true`, withCheck: sql`true`  }),
]);

export const dealers = pgTable("dealers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 200 }).notNull(),
	contactName: varchar("contact_name", { length: 100 }),
	phone: varchar({ length: 20 }),
	region: varchar({ length: 200 }),
	status: varchar({ length: 20 }).default('active').notNull(),
	remark: text(),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("dealers_name_idx").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("dealers_phone_idx").using("btree", table.phone.asc().nullsLast().op("text_ops")),
	index("dealers_region_idx").using("btree", table.region.asc().nullsLast().op("text_ops")),
	index("dealers_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	pgPolicy("dealers_all", { as: "permissive", for: "all", to: ["public"], using: sql`true`, withCheck: sql`true`  }),
]);
