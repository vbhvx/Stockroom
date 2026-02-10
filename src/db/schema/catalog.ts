import { pgTable, text, timestamp, varchar, integer, bigint, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { organizations, stores } from "./organizations";

export const products = pgTable("products", {
  id: varchar("id", { length: 64 }).primaryKey(),
  organizationId: varchar("organization_id", { length: 64 })
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  description: text("description"),
  brand: text("brand"),
  status: text("status").notNull().default("draft"), // 'draft', 'active', 'archived'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const productVariants = pgTable(
  "product_variants",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 64 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    productId: varchar("product_id", { length: 64 })
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 100 }).notNull(),
    barcode: varchar("barcode", { length: 100 }),
    variantAttributes: jsonb("variant_attributes").$type<Record<string, string>>().default({}),
    unitOfMeasure: varchar("unit_of_measure", { length: 32 }).notNull().default("unit"),
    weight: integer("weight"), // in grams
    status: text("status").notNull().default("active"), // 'active', 'inactive', 'discontinued'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("variant_org_sku_unique_idx").on(table.organizationId, table.sku),
  ]
);

export const productPrices = pgTable("product_prices", {
  id: varchar("id", { length: 64 }).primaryKey(),
  organizationId: varchar("organization_id", { length: 64 })
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  storeId: varchar("store_id", { length: 64 })
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  variantId: varchar("variant_id", { length: 64 })
    .notNull()
    .references(() => productVariants.id, { onDelete: "cascade" }),
  currency: varchar("currency", { length: 3 }).notNull(),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).defaultNow().notNull(),
  effectiveTo: timestamp("effective_to", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

