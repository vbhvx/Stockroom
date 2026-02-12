import { pgTable, text, timestamp, varchar, integer, uniqueIndex, index } from "drizzle-orm/pg-core";
import { organizations, stores } from "./organizations";
import { productVariants } from "./catalog";

export const inventoryLocations = pgTable("inventory_locations", {
  id: varchar("id", { length: 64 }).primaryKey(),
  organizationId: varchar("organization_id", { length: 64 })
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  storeId: varchar("store_id", { length: 64 })
    .references(() => stores.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  locationCode: varchar("location_code", { length: 50 }).notNull(),
  status: text("status").notNull().default("active"), // 'active', 'inactive'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const inventoryBalances = pgTable(
  "inventory_balances",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 64 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    locationId: varchar("location_id", { length: 64 })
      .notNull()
      .references(() => inventoryLocations.id, { onDelete: "cascade" }),
    variantId: varchar("variant_id", { length: 64 })
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    onHand: integer("on_hand").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    version: integer("version").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("balance_location_variant_unique_idx").on(table.locationId, table.variantId),
    index("balance_org_variant_idx").on(table.organizationId, table.variantId),
  ]
);

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 64 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    locationId: varchar("location_id", { length: 64 })
      .notNull()
      .references(() => inventoryLocations.id, { onDelete: "cascade" }),
    variantId: varchar("variant_id", { length: 64 })
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    movementType: text("movement_type").notNull(), 
    // 'receipt', 'reservation', 'reservation_release', 'shipment', 'adjustment', 'return', 'transfer_in', 'transfer_out', 'correction'
    quantityDelta: integer("quantity_delta").notNull(),
    referenceType: text("reference_type").notNull(), // 'order', 'adjustment', 'receipt', 'transfer', 'shipment', 'reconciliation'
    referenceId: text("reference_id").notNull(),
    reason: text("reason").notNull(),
    actorId: text("actor_id").notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("movements_org_variant_idx").on(table.organizationId, table.variantId),
    index("movements_ref_idx").on(table.referenceType, table.referenceId),
    uniqueIndex("movements_idempotency_key_idx").on(table.organizationId, table.idempotencyKey),
  ]
);

export const inventoryTransfers = pgTable(
  "inventory_transfers",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 64 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    fromLocationId: varchar("from_location_id", { length: 64 })
      .notNull()
      .references(() => inventoryLocations.id, { onDelete: "cascade" }),
    toLocationId: varchar("to_location_id", { length: 64 })
      .notNull()
      .references(() => inventoryLocations.id, { onDelete: "cascade" }),
    variantId: varchar("variant_id", { length: 64 })
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    status: text("status").notNull().default("requested"), // 'requested', 'in_transit', 'received', 'cancelled'
    trackingNumber: text("tracking_number"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  }
);

