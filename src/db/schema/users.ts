import { pgTable, text, timestamp, varchar, uniqueIndex } from "drizzle-orm/pg-core";
import { organizations, stores } from "./organizations";

export const users = pgTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const staffMemberships = pgTable(
  "staff_memberships",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 64 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    storeId: varchar("store_id", { length: 64 })
      .references(() => stores.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // 'owner', 'admin', 'catalog_manager', 'inventory_manager', 'order_manager', 'fulfillment_staff', 'finance_staff', 'support_staff', 'viewer'
    status: text("status").notNull().default("active"), // 'active', 'suspended', 'invited'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("staff_org_user_store_unique_idx").on(
      table.organizationId,
      table.userId,
      table.storeId
    ),
  ]
);

export const sessions = pgTable("sessions", {
  id: varchar("id", { length: 128 }).primaryKey(),
  userId: varchar("user_id", { length: 64 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id", { length: 64 })
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  storeId: varchar("store_id", { length: 64 })
    .references(() => stores.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

