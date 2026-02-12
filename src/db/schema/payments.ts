import { pgTable, text, timestamp, varchar, bigint, uniqueIndex, index, jsonb } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { orders } from "./orders";

export const payments = pgTable(
  "payments",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 64 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    orderId: varchar("order_id", { length: 64 })
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("simulated"), // 'simulated', 'stripe', 'manual'
    providerPaymentId: text("provider_payment_id"),
    paymentStatus: text("payment_status").notNull().default("pending"),
    // 'pending', 'authorized', 'captured', 'failed', 'cancelled', 'partially_refunded', 'refunded'
    currency: varchar("currency", { length: 3 }).notNull(),
    authorizedAmountMinor: bigint("authorized_amount_minor", { mode: "number" }).notNull().default(0),
    capturedAmountMinor: bigint("captured_amount_minor", { mode: "number" }).notNull().default(0),
    refundedAmountMinor: bigint("refunded_amount_minor", { mode: "number" }).notNull().default(0),
    idempotencyKey: varchar("idempotency_key", { length: 255 }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("payments_order_id_idx").on(table.orderId),
    index("payments_org_status_idx").on(table.organizationId, table.paymentStatus),
    uniqueIndex("payments_idempotency_idx").on(table.organizationId, table.idempotencyKey),
  ]
);

export const refunds = pgTable(
  "refunds",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 64 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    paymentId: varchar("payment_id", { length: 64 })
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    providerRefundId: text("provider_refund_id"),
    idempotencyKey: varchar("idempotency_key", { length: 255 }),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    status: text("status").notNull().default("pending"), // 'pending', 'succeeded', 'failed', 'uncertain'
    reason: text("reason").notNull(),
    requestedBy: text("requested_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("refunds_payment_id_idx").on(table.paymentId),
    uniqueIndex("refunds_idempotency_idx").on(table.organizationId, table.idempotencyKey),
  ]
);

export const providerEvents = pgTable(
  "provider_events",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 64 })
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerEventId: varchar("provider_event_id", { length: 255 }).notNull().unique(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("received"), // 'received', 'processed', 'ignored', 'failed'
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("provider_events_provider_idx").on(table.provider, table.providerEventId),
  ]
);

