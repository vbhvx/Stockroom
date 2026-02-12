import { pgTable, text, timestamp, varchar, integer, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { orders, orderLines } from "./orders";
import { inventoryLocations } from "./inventory";

export const fulfillments = pgTable(
  "fulfillments",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 64 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    orderId: varchar("order_id", { length: 64 })
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    locationId: varchar("location_id", { length: 64 })
      .notNull()
      .references(() => inventoryLocations.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    // 'pending', 'picking', 'packed', 'shipped', 'delivered', 'cancelled', 'failed'
    carrier: text("carrier"),
    trackingNumber: text("tracking_number"),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("fulfillments_order_id_idx").on(table.orderId),
    index("fulfillments_org_status_idx").on(table.organizationId, table.status),
  ]
);

export const fulfillmentLines = pgTable(
  "fulfillment_lines",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    fulfillmentId: varchar("fulfillment_id", { length: 64 })
      .notNull()
      .references(() => fulfillments.id, { onDelete: "cascade" }),
    orderLineId: varchar("order_line_id", { length: 64 })
      .notNull()
      .references(() => orderLines.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("flines_fulfillment_id_idx").on(table.fulfillmentId),
  ]
);

export const fulfillmentExceptions = pgTable(
  "fulfillment_exceptions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 64 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    fulfillmentId: varchar("fulfillment_id", { length: 64 })
      .notNull()
      .references(() => fulfillments.id, { onDelete: "cascade" }),
    exceptionType: text("exception_type").notNull(), // 'shortage', 'damaged', 'carrier_error', 'address_issue', 'other'
    status: text("status").notNull().default("open"), // 'open', 'investigating', 'resolved'
    reason: text("reason").notNull(),
    owner: text("owner"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("exceptions_fulfillment_id_idx").on(table.fulfillmentId),
  ]
);

