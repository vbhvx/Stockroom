import { db } from "@/db/client";
import {
  orders,
  orderLines,
  products,
  productVariants,
  productPrices,
  stores,
  inventoryLocations,
} from "@/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  ConflictError,
  NotFoundError,
  StateTransitionError,
  ValidationError,
} from "../errors/app-error";
import { AuditService } from "./audit-service";
import { InventoryService } from "./inventory-service";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "partially_fulfilled"
  | "fulfilled"
  | "cancelled"
  | "on_hold";

export interface CreateOrderLineInput {
  variantId: string;
  quantity: number;
  discountMinor?: number;
  taxMinor?: number;
}

export interface CreateOrderInput {
  storeId: string;
  locationId: string;
  customerReference: string;
  lines: CreateOrderLineInput[];
  shippingMinor?: number;
  source?: string;
  idempotencyKey?: string;
  autoConfirm?: boolean;
}

const ALLOWED_ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["confirmed", "cancelled", "on_hold"],
  confirmed: ["processing", "cancelled", "on_hold"],
  processing: ["partially_fulfilled", "fulfilled", "cancelled", "on_hold"],
  partially_fulfilled: ["fulfilled", "cancelled", "on_hold"],
  on_hold: ["pending", "confirmed", "processing", "cancelled"],
  fulfilled: [], // Terminal
  cancelled: [], // Terminal
};

export class OrderService {
  /**
   * Create an order with exact monetary calculation, line snapshotting, and atomic stock reservation.
   */
  static async createOrder(organizationId: string, input: CreateOrderInput, actorId: string) {
    if (!input.lines || input.lines.length === 0) {
      throw new ValidationError("Order must contain at least one line item");
    }

    // Verify store exists and retrieve currency
    const [store] = await db
      .select()
      .from(stores)
      .where(and(eq(stores.id, input.storeId), eq(stores.organizationId, organizationId)))
      .limit(1);

    if (!store) {
      throw new NotFoundError("Store", input.storeId);
    }

    // Verify location exists
    const [location] = await db
      .select()
      .from(inventoryLocations)
      .where(and(eq(inventoryLocations.id, input.locationId), eq(inventoryLocations.organizationId, organizationId)))
      .limit(1);

    if (!location) {
      throw new NotFoundError("InventoryLocation", input.locationId);
    }

    // Check idempotency key if provided
    if (input.idempotencyKey) {
      const [existingOrder] = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.organizationId, organizationId),
            eq(orders.idempotencyKey, input.idempotencyKey)
          )
        )
        .limit(1);

      if (existingOrder) {
        return this.getOrderDetails(organizationId, existingOrder.id);
      }
    }

    // Resolve variants and price snapshots
    const variantIds = input.lines.map((l) => l.variantId);
    const variants = await db
      .select({
        variant: productVariants,
        productName: products.name,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(
        and(
          eq(productVariants.organizationId, organizationId),
          inArray(productVariants.id, variantIds)
        )
      );

    if (variants.length !== input.lines.length) {
      throw new ValidationError("One or more variant IDs are invalid or belong to another organization");
    }

    // Retrieve active prices for these variants
    const prices = await db
      .select()
      .from(productPrices)
      .where(
        and(
          eq(productPrices.organizationId, organizationId),
          eq(productPrices.storeId, input.storeId),
          eq(productPrices.currency, store.currency),
          inArray(productPrices.variantId, variantIds)
        )
      )
      .orderBy(desc(productPrices.effectiveFrom));

    // Calculate line totals and verify exact pricing
    let subtotalMinor = 0;
    const computedLines: Array<{
      id: string;
      variantId: string;
      skuSnapshot: string;
      productNameSnapshot: string;
      quantityOrdered: number;
      unitPriceMinor: number;
      discountMinor: number;
      taxMinor: number;
      lineTotalMinor: number;
    }> = [];

    for (const line of input.lines) {
      if (line.quantity <= 0) {
        throw new ValidationError("Line quantity must be positive");
      }

      const variantRecord = variants.find((v) => v.variant.id === line.variantId);
      if (!variantRecord) {
        throw new NotFoundError("ProductVariant", line.variantId);
      }

      const activePrice = prices.find((p) => p.variantId === line.variantId);
      if (!activePrice) {
        throw new ValidationError(
          `No active price found for variant SKU '${variantRecord.variant.sku}' in currency '${store.currency}'`
        );
      }

      const unitPriceMinor = activePrice.amountMinor;
      const discountMinor = line.discountMinor || 0;
      const taxMinor = line.taxMinor || 0;
      const lineTotalMinor = line.quantity * unitPriceMinor - discountMinor + taxMinor;

      if (lineTotalMinor < 0) {
        throw new ValidationError("Line item total cannot be negative");
      }

      subtotalMinor += lineTotalMinor;

      computedLines.push({
        id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        variantId: line.variantId,
        skuSnapshot: variantRecord.variant.sku,
        productNameSnapshot: variantRecord.productName,
        quantityOrdered: line.quantity,
        unitPriceMinor,
        discountMinor,
        taxMinor,
        lineTotalMinor,
      });
    }

    const shippingMinor = input.shippingMinor || 0;
    const totalMinor = subtotalMinor + shippingMinor;
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    return await db.transaction(async (tx) => {
      // 1. Insert order
      const initialStatus: OrderStatus = input.autoConfirm ? "confirmed" : "pending";
      const [order] = await tx
        .insert(orders)
        .values({
          id: orderId,
          organizationId,
          storeId: input.storeId,
          orderNumber,
          source: input.source || "internal_dashboard",
          orderStatus: initialStatus,
          currency: store.currency,
          subtotalMinor,
          discountMinor: 0,
          taxMinor: 0,
          shippingMinor,
          totalMinor,
          customerReference: input.customerReference,
          idempotencyKey: input.idempotencyKey || null,
        })
        .returning();

      // 2. Insert order lines with frozen snapshot values
      for (const line of computedLines) {
        await tx.insert(orderLines).values({
          id: line.id,
          orderId,
          variantId: line.variantId,
          skuSnapshot: line.skuSnapshot,
          productNameSnapshot: line.productNameSnapshot,
          quantityOrdered: line.quantityOrdered,
          unitPriceMinor: line.unitPriceMinor,
          discountMinor: line.discountMinor,
          taxMinor: line.taxMinor,
          lineTotalMinor: line.lineTotalMinor,
        });

        // 3. Atomically reserve inventory for each line
        await InventoryService.reserveStock(
          tx,
          organizationId,
          input.locationId,
          line.variantId,
          line.quantityOrdered,
          orderId,
          actorId,
          `ord_res_${orderId}_${line.variantId}`
        );
      }

      // 4. Record audit event
      await AuditService.record(tx, {
        organizationId,
        storeId: input.storeId,
        actorId,
        action: "order.created",
        resourceType: "order",
        resourceId: orderId,
        afterState: order,
        reason: `Created order ${orderNumber} for ${input.customerReference} with total ${totalMinor} (${store.currency})`,
      });

      return {
        ...order,
        lines: computedLines,
      };
    });
  }

  /**
   * Validate and transition order operational status.
   */
  static async transitionStatus(
    organizationId: string,
    orderId: string,
    targetStatus: OrderStatus,
    reason: string,
    actorId: string
  ) {
    const [existing] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.organizationId, organizationId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundError("Order", orderId);
    }

    const currentStatus = existing.orderStatus as OrderStatus;
    const allowed = ALLOWED_ORDER_TRANSITIONS[currentStatus];

    if (!allowed.includes(targetStatus)) {
      throw new StateTransitionError("order", currentStatus, targetStatus);
    }

    const [updated] = await db
      .update(orders)
      .set({
        orderStatus: targetStatus,
        updatedAt: new Date(),
      })
      .where(and(eq(orders.id, orderId), eq(orders.organizationId, organizationId)))
      .returning();

    await AuditService.record(db, {
      organizationId,
      storeId: existing.storeId,
      actorId,
      action: `order.status.${targetStatus}`,
      resourceType: "order",
      resourceId: orderId,
      beforeState: existing,
      afterState: updated,
      reason: reason || `Status transitioned from ${currentStatus} to ${targetStatus}`,
    });

    return updated;
  }

  /**
   * Safe order cancellation:
   * - Releases reserved unshipped stock exactly once.
   * - Marks order status as 'cancelled'.
   */
  static async cancelOrder(
    organizationId: string,
    orderId: string,
    locationId: string,
    reason: string,
    actorId: string
  ) {
    if (!reason || reason.trim().length === 0) {
      throw new ValidationError("A reason is required to cancel an order");
    }

    return await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.organizationId, organizationId)))
        .limit(1);

      if (!order) {
        throw new NotFoundError("Order", orderId);
      }

      if (order.orderStatus === "fulfilled") {
        throw new StateTransitionError("order", "fulfilled", "cancelled");
      }
      if (order.orderStatus === "cancelled") {
        return { order, message: "Order is already cancelled" };
      }

      // Fetch order lines
      const lines = await tx
        .select()
        .from(orderLines)
        .where(eq(orderLines.orderId, orderId));

      // Release reserved stock for each line (only unfulfilled portion)
      for (const line of lines) {
        const unshippedQty = line.quantityOrdered - line.quantityFulfilled;
        if (unshippedQty > 0) {
          await InventoryService.releaseReservation(
            tx,
            organizationId,
            locationId,
            line.variantId,
            unshippedQty,
            orderId,
            actorId,
            `ord_rel_${orderId}_${line.variantId}`
          );
        }
      }

      // Update order status
      const [cancelledOrder] = await tx
        .update(orders)
        .set({
          orderStatus: "cancelled",
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning();

      await AuditService.record(tx, {
        organizationId,
        storeId: order.storeId,
        actorId,
        action: "order.cancelled",
        resourceType: "order",
        resourceId: orderId,
        beforeState: order,
        afterState: cancelledOrder,
        reason: reason.trim(),
      });

      return {
        order: cancelledOrder,
        lines,
      };
    });
  }

  /**
   * Retrieve order with lines, payments, and fulfillments.
   */
  static async getOrderDetails(organizationId: string, orderId: string) {
    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.organizationId, organizationId)))
      .limit(1);

    if (!order) {
      throw new NotFoundError("Order", orderId);
    }

    const lines = await db
      .select()
      .from(orderLines)
      .where(eq(orderLines.orderId, orderId));

    return {
      ...order,
      lines,
    };
  }

  /**
   * List orders with optional filters.
   */
  static async listOrders(
    organizationId: string,
    filters?: {
      storeId?: string;
      status?: OrderStatus;
      search?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const conditions = [eq(orders.organizationId, organizationId)];

    if (filters?.storeId) {
      conditions.push(eq(orders.storeId, filters.storeId));
    }
    if (filters?.status) {
      conditions.push(eq(orders.orderStatus, filters.status));
    }

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    const items = await db
      .select()
      .from(orders)
      .where(and(...conditions))
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);

    // Fetch lines for each order
    const orderIds = items.map((o) => o.id);
    let allLines: (typeof orderLines.$inferSelect)[] = [];
    if (orderIds.length > 0) {
      allLines = await db
        .select()
        .from(orderLines)
        .where(sql`${orderLines.orderId} IN ${orderIds}`);
    }

    return items.map((order) => ({
      ...order,
      lines: allLines.filter((l) => l.orderId === order.id),
    }));
  }
}

