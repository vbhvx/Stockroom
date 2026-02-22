import { db } from "@/db/client";
import {
  orders,
  inventoryBalances,
  inventoryMovements,
  payments,
  fulfillmentExceptions,
  auditEvents,
  productVariants,
  products,
} from "@/db/schema";
import { eq, and, sql, desc, or } from "drizzle-orm";

export class ReportingService {
  static async getOperationalSummary(organizationId: string) {
    // 1. Order counts
    const [ordersAwaitingAction] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          eq(orders.organizationId, organizationId),
          or(eq(orders.orderStatus, "pending"), eq(orders.orderStatus, "confirmed"))
        )
      );

    const [ordersProcessing] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          eq(orders.organizationId, organizationId),
          eq(orders.orderStatus, "processing")
        )
      );

    const [ordersFulfilled] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          eq(orders.organizationId, organizationId),
          eq(orders.orderStatus, "fulfilled")
        )
      );

    // 2. Inventory alerts: Low stock (available <= 5)
    const lowStockItems = await db
      .select({
        id: inventoryBalances.id,
        variantId: inventoryBalances.variantId,
        sku: productVariants.sku,
        productName: products.name,
        onHand: inventoryBalances.onHand,
        reserved: inventoryBalances.reserved,
        available: sql<number>`(${inventoryBalances.onHand} - ${inventoryBalances.reserved})::int`,
      })
      .from(inventoryBalances)
      .innerJoin(productVariants, eq(inventoryBalances.variantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(
        and(
          eq(inventoryBalances.organizationId, organizationId),
          sql`(${inventoryBalances.onHand} - ${inventoryBalances.reserved}) <= 5`
        )
      )
      .limit(10);

    // 3. Payment alerts: Pending or failed
    const [pendingPaymentsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(payments)
      .where(
        and(
          eq(payments.organizationId, organizationId),
          eq(payments.paymentStatus, "pending")
        )
      );

    const [failedPaymentsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(payments)
      .where(
        and(
          eq(payments.organizationId, organizationId),
          eq(payments.paymentStatus, "failed")
        )
      );

    // 4. Fulfillment exceptions
    const [openExceptionsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(fulfillmentExceptions)
      .where(
        and(
          eq(fulfillmentExceptions.organizationId, organizationId),
          eq(fulfillmentExceptions.status, "open")
        )
      );

    // 5. Recent audit events
    const recentActivity = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.organizationId, organizationId))
      .orderBy(desc(auditEvents.createdAt))
      .limit(10);

    return {
      orders: {
        awaitingAction: ordersAwaitingAction?.count || 0,
        processing: ordersProcessing?.count || 0,
        fulfilled: ordersFulfilled?.count || 0,
      },
      inventory: {
        lowStockCount: lowStockItems.length,
        lowStockItems,
      },
      payments: {
        pending: pendingPaymentsCount?.count || 0,
        failed: failedPaymentsCount?.count || 0,
      },
      fulfillment: {
        openExceptions: openExceptionsCount?.count || 0,
      },
      recentActivity,
    };
  }
}

