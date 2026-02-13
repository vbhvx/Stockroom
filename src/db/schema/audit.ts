import { pgTable, text, timestamp, varchar, jsonb, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const auditEvents = pgTable(
  "audit_events",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 64 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    storeId: varchar("store_id", { length: 64 }),
    actorId: text("actor_id").notNull(),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    beforeState: jsonb("before_state").$type<Record<string, unknown>>(),
    afterState: jsonb("after_state").$type<Record<string, unknown>>(),
    reason: text("reason"),
    requestId: text("request_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("audit_org_resource_idx").on(table.organizationId, table.resourceType, table.resourceId),
    index("audit_org_created_idx").on(table.organizationId, table.createdAt),
  ]
);

