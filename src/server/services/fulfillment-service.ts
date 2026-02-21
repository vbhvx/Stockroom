import { db } from "@/db/client";
import {
  fulfillments,
  fulfillmentLines,
  fulfillmentExceptions,
  orders,
  orderLines,
  inventoryLocations,
} from "@/db/schema";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import {
  NotFoundError,
  StateTransitionError,
  ValidationError,
} from "../errors/app-error";
import { AuditService } from "./audit-service";
import { InventoryService } from "./inventory-service";

export type FulfillmentStatus =
  | "pending"
  | "picking"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "failed";

export interface CreateFulfillmentInput {
  orderId: string;
  locationId: string;
  carrier?: string;
  trackingNumber?: string;
  lines: Array<{
    orderLineId: string;
    quantity: number;
  }>;
}

export interface ShipFulfillmentInput {
  carrier?: string;
  trackingNumber?: string;
  idempotencyKey?: string;
}

export class FulfillmentService {
  /**
   * Create an eligible fulfillment for an order.
   * Validates partial quantities so fulfillment lines do not exceed eligible remaining quantities.
   */
  static async createFulfillment(
    organizationId: string,
    input: CreateFulfillmentInput,
    actorId: string
  ) {
    if (!input.lines || input.lines.length === 0) {
      throw new ValidationError("Fulfillment must contain at least one line");
    }

    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, input.orderId), eq(orders.organizationId, organizationId)))
      .limit(1);

    if (!order) {
      throw new NotFoundError("Order", input.orderId);
    }

    if (order.orderStatus === "cancelled") {
      throw new ValidationError("Cannot fulfill a cancelled order");
    }

    // Verify order lines
    const lineIds = input.lines.map((l) => l.orderLineId);
    const orderLineRecords = await db
      .select()
      .from(orderLines)
      .where(and(eq(orderLines.orderId, input.orderId), inArray(orderLines.id, lineIds)));

    if (orderLineRecords.length !== input.lines.length) {
      throw new ValidationError("One or more orderLineIds do not belong to this order");
    }

    // Validate quantities
    for (const lineInput of input.lines) {
      if (lineInput.quantity <= 0) {
        throw new ValidationError("Fulfillment quantity must be strictly positive");
      }
      const record = orderLineRecords.find((r) => r.id === lineInput.orderLineId)!;
      const remainingEligible = record.quantityOrdered - record.quantityFulfilled;
      if (lineInput.quantity > remainingEligible) {
        throw new ValidationError(
          `Requested fulfillment quantity (${lineInput.quantity}) exceeds remaining unfulfilled quantity (${remainingEligible}) for SKU ${record.skuSnapshot}`
        );
      }
    }

    const fulfillmentId = `ful_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return await db.transaction(async (tx) => {
      const [fulfillment] = await tx
        .insert(fulfillments)
        .values({
          id: fulfillmentId,
          organizationId,
          orderId: input.orderId,
          locationId: input.locationId,
          status: "pending",
          carrier: input.carrier || null,
          trackingNumber: input.trackingNumber || null,
        })
        .returning();

      for (const line of input.lines) {
        await tx.insert(fulfillmentLines).values({
          id: `fline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          fulfillmentId,
          orderLineId: line.orderLineId,
          quantity: line.quantity,
        });
      }

      await AuditService.record(tx, {
        organizationId,
        actorId,
        action: "fulfillment.created",
        resourceType: "fulfillment",
        resourceId: fulfillmentId,
        afterState: fulfillment,
        reason: `Created fulfillment package for order ${order.orderNumber}`,
      });

      return fulfillment;
    });
  }

  /**
   * Mark fulfillment picking in progress or completed.
   */
  static async startPicking(organizationId: string, fulfillmentId: string, actorId: string) {
    const [existing] = await db
      .select()
      .from(fulfillments)
      .where(and(eq(fulfillments.id, fulfillmentId), eq(fulfillments.organizationId, organizationId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundError("Fulfillment", fulfillmentId);
    }

    if (existing.status !== "pending") {
      throw new StateTransitionError("fulfillment", existing.status, "picking");
    }

    const [updated] = await db
      .update(fulfillments)
      .set({ status: "picking", updatedAt: new Date() })
      .where(eq(fulfillments.id, fulfillmentId))
      .returning();

    await AuditService.record(db, {
      organizationId,
      actorId,
      action: "fulfillment.picking",
      resourceType: "fulfillment",
      resourceId: fulfillmentId,
      beforeState: existing,
      afterState: updated,
      reason: "Picking goods from warehouse",
    });

    return updated;
  }

  /**
   * Mark goods packed.
   */
  static async packFulfillment(organizationId: string, fulfillmentId: string, actorId: string) {
    const [existing] = await db
      .select()
      .from(fulfillments)
      .where(and(eq(fulfillments.id, fulfillmentId), eq(fulfillments.organizationId, organizationId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundError("Fulfillment", fulfillmentId);
    }

    if (existing.status !== "picking" && existing.status !== "pending") {
      throw new StateTransitionError("fulfillment", existing.status, "packed");
    }

    const [updated] = await db
      .update(fulfillments)
      .set({ status: "packed", updatedAt: new Date() })
      .where(eq(fulfillments.id, fulfillmentId))
      .returning();

    await AuditService.record(db, {
      organizationId,
      actorId,
      action: "fulfillment.packed",
      resourceType: "fulfillment",
      resourceId: fulfillmentId,
      beforeState: existing,
      afterState: updated,
      reason: "Goods packed and ready for dispatch",
    });

    return updated;
  }

  /**
   * Confirm shipment and atomically deduct stock exactly once.
   */
  static async shipFulfillment(
    organizationId: string,
    fulfillmentId: string,
    input: ShipFulfillmentInput,
    actorId: string
  ) {
    const [existing] = await db
      .select()
      .from(fulfillments)
      .where(and(eq(fulfillments.id, fulfillmentId), eq(fulfillments.organizationId, organizationId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundError("Fulfillment", fulfillmentId);
    }

    if (existing.status === "shipped" || existing.status === "delivered") {
      return {
        fulfillment: existing,
        message: "Fulfillment is already confirmed as shipped",
        idempotentReplay: true,
      };
    }

    if (existing.status === "cancelled") {
      throw new StateTransitionError("fulfillment", "cancelled", "shipped");
    }

    // Retrieve fulfillment lines and order lines
    const fLines = await db
      .select()
      .from(fulfillmentLines)
      .where(eq(fulfillmentLines.fulfillmentId, fulfillmentId));

    const orderLineIds = fLines.map((fl) => fl.orderLineId);
    const oLines = await db
      .select()
      .from(orderLines)
      .where(inArray(orderLines.id, orderLineIds));

    return await db.transaction(async (tx) => {
      // 1. Atomically deduct inventory movements for each line item (reduces onHand and reserved)
      for (const fLine of fLines) {
        const oLine = oLines.find((ol) => ol.id === fLine.orderLineId)!;

        await InventoryService.deductShipment(
          tx,
          organizationId,
          existing.locationId,
          oLine.variantId,
          fLine.quantity,
          fulfillmentId,
          actorId,
          `ship_${fulfillmentId}_${oLine.variantId}`
        );

        // Update order line fulfilled count
        await tx
          .update(orderLines)
          .set({
            quantityFulfilled: oLine.quantityFulfilled + fLine.quantity,
          })
          .where(eq(orderLines.id, oLine.id));
      }

      // 2. Update fulfillment record
      const [updatedFulfillment] = await tx
        .update(fulfillments)
        .set({
          status: "shipped",
          carrier: input.carrier || existing.carrier || "Standard Carrier",
          trackingNumber: input.trackingNumber || existing.trackingNumber || `TRK${Date.now().toString().slice(-8)}`,
          shippedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(fulfillments.id, fulfillmentId))
        .returning();

      // 3. Check overall order fulfillment status
      const allOrderLines = await tx
        .select()
        .from(orderLines)
        .where(eq(orderLines.orderId, existing.orderId));

      const isAllFulfilled = allOrderLines.every((l) => l.quantityFulfilled >= l.quantityOrdered);
      const isAnyFulfilled = allOrderLines.some((l) => l.quantityFulfilled > 0);

      const targetOrderStatus = isAllFulfilled
        ? "fulfilled"
        : isAnyFulfilled
        ? "partially_fulfilled"
        : "processing";

      await tx
        .update(orders)
        .set({
          orderStatus: targetOrderStatus,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, existing.orderId));

      // 4. Record audit event
      await AuditService.record(tx, {
        organizationId,
        actorId,
        action: "fulfillment.shipped",
        resourceType: "fulfillment",
        resourceId: fulfillmentId,
        beforeState: existing,
        afterState: updatedFulfillment,
        reason: `Dispatched tracking: ${updatedFulfillment.trackingNumber}. Stock deducted.`,
      });

      return {
        fulfillment: updatedFulfillment,
        idempotentReplay: false,
      };
    });
  }

  /**
   * Log a fulfillment exception (damaged, shortage, etc.).
   */
  static async logException(
    organizationId: string,
    fulfillmentId: string,
    exceptionType: string,
    reason: string,
    actorId: string
  ) {
    if (!reason || reason.trim().length === 0) {
      throw new ValidationError("An explicit reason is required to log an exception");
    }

    const id = `fexc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const [exception] = await db
      .insert(fulfillmentExceptions)
      .values({
        id,
        organizationId,
        fulfillmentId,
        exceptionType,
        reason: reason.trim(),
        status: "open",
        owner: actorId,
      })
      .returning();

    await AuditService.record(db, {
      organizationId,
      actorId,
      action: "fulfillment.exception_logged",
      resourceType: "fulfillment_exception",
      resourceId: id,
      afterState: exception,
      reason: `Exception (${exceptionType}): ${reason}`,
    });

    return exception;
  }

  /**
   * Resolve an exception.
   */
  static async resolveException(
    organizationId: string,
    exceptionId: string,
    resolutionNotes: string,
    actorId: string
  ) {
    const [existing] = await db
      .select()
      .from(fulfillmentExceptions)
      .where(and(eq(fulfillmentExceptions.id, exceptionId), eq(fulfillmentExceptions.organizationId, organizationId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundError("FulfillmentException", exceptionId);
    }

    const [resolved] = await db
      .update(fulfillmentExceptions)
      .set({
        status: "resolved",
        resolvedAt: new Date(),
      })
      .where(eq(fulfillmentExceptions.id, exceptionId))
      .returning();

    await AuditService.record(db, {
      organizationId,
      actorId,
      action: "fulfillment.exception_resolved",
      resourceType: "fulfillment_exception",
      resourceId: exceptionId,
      beforeState: existing,
      afterState: resolved,
      reason: resolutionNotes || "Exception resolved by staff",
    });

    return resolved;
  }

  /**
   * List fulfillments for an order or organization.
   */
  static async listFulfillments(organizationId: string, orderId?: string) {
    const conditions = [eq(fulfillments.organizationId, organizationId)];
    if (orderId) {
      conditions.push(eq(fulfillments.orderId, orderId));
    }

    const items = await db
      .select({
        id: fulfillments.id,
        organizationId: fulfillments.organizationId,
        orderId: fulfillments.orderId,
        locationId: fulfillments.locationId,
        status: fulfillments.status,
        carrier: fulfillments.carrier,
        trackingNumber: fulfillments.trackingNumber,
        shippedAt: fulfillments.shippedAt,
        deliveredAt: fulfillments.deliveredAt,
        createdAt: fulfillments.createdAt,
        locationCode: inventoryLocations.locationCode,
        orderNumber: orders.orderNumber,
      })
      .from(fulfillments)
      .innerJoin(inventoryLocations, eq(fulfillments.locationId, inventoryLocations.id))
      .innerJoin(orders, eq(fulfillments.orderId, orders.id))
      .where(and(...conditions))
      .orderBy(desc(fulfillments.createdAt));

    return items;
  }
}

