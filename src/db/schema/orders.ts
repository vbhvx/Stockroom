import { pgTable, text, timestamp, varchar, integer, bigint, uniqueIndex, index } from "drizzle-orm/pg-core";
import { organizations, stores } from "./organizations";
import { productVariants } from "./catalog";

export const orders = pgTable(
  "orders",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 64 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    storeId: varchar("store_id", { length: 64 })
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    orderNumber: varchar("order_number", { length: 50 }).notNull(),
    source: text("source").notNull().default("internal_dashboard"), // 'internal_dashboard', 'storefront_api', 'import'
    orderStatus: text("order_status").notNull().default("pending"), 
    // 'pending', 'confirmed', 'processing', 'partially_fulfilled', 'fulfilled', 'cancelled', 'on_hold'
    currency: varchar("currency", { length: 3 }).notNull(),
    subtotalMinor: bigint("subtotal_minor", { mode: "number" }).notNull(),
    discountMinor: bigint("discount_minor", { mode: "number" }).notNull().default(0),
    taxMinor: bigint("tax_minor", { mode: "number" }).notNull().default(0),
    shippingMinor: bigint("shipping_minor", { mode: "number" }).notNull().default(0),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull(),
    customerReference: text("customer_reference").notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("order_org_number_unique_idx").on(table.organizationId, table.orderNumber),
    index("order_org_status_idx").on(table.organizationId, table.orderStatus),
  ]
);

export const orderLines = pgTable(
  "order_lines",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    orderId: varchar("order_id", { length: 64 })
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    variantId: varchar("variant_id", { length: 64 })
      .notNull()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    skuSnapshot: varchar("sku_snapshot", { length: 100 }).notNull(),
    productNameSnapshot: text("product_name_snapshot").notNull(),
    quantityOrdered: integer("quantity_ordered").notNull(),
    quantityFulfilled: integer("quantity_fulfilled").notNull().default(0),
    unitPriceMinor: bigint("unit_price_minor", { mode: "number" }).notNull(),
    discountMinor: bigint("discount_minor", { mode: "number" }).notNull().default(0),
    taxMinor: bigint("tax_minor", { mode: "number" }).notNull().default(0),
    lineTotalMinor: bigint("line_total_minor", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("lines_order_id_idx").on(table.orderId),
  ]
);

