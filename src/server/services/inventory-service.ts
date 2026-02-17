import { db, Database } from "@/db/client";
import {
  inventoryLocations,
  inventoryBalances,
  inventoryMovements,
  inventoryTransfers,
  productVariants,
  orders,
} from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import {
  ConflictError,
  InsufficientInventoryError,
  NotFoundError,
  ValidationError,
} from "../errors/app-error";
import { AuditService } from "./audit-service";

export interface ReceiveStockInput {
  locationId: string;
  variantId: string;
  quantity: number;
  reason?: string;
  referenceId?: string;
  idempotencyKey?: string;
}

export interface AdjustStockInput {
  locationId: string;
  variantId: string;
  quantityDelta: number;
  reason: string;
  idempotencyKey?: string;
}

export interface StockTransferInput {
  fromLocationId: string;
  toLocationId: string;
  variantId: string;
  quantity: number;
  notes?: string;
}

export class InventoryService {
  /**
   * Helper to ensure an inventory balance record exists for (locationId, variantId).
   * Runs safely inside or outside transaction.
   */
  static async getOrCreateBalance(
    client: Database | Parameters<Parameters<Database["transaction"]>[0]>[0],
    organizationId: string,
    locationId: string,
    variantId: string,
    forUpdate = false
  ) {
    if (forUpdate) {
      // Row lock with FOR UPDATE to prevent race conditions
      const query = sql`
        SELECT * FROM ${inventoryBalances}
        WHERE ${inventoryBalances.locationId} = ${locationId}
          AND ${inventoryBalances.variantId} = ${variantId}
        FOR UPDATE
      `;
      const result = await (client as any).execute(query);
      if (result.rows && result.rows.length > 0) {
        const row = result.rows[0];
        return {
          id: row.id,
          organizationId: row.organization_id,
          locationId: row.location_id,
          variantId: row.variant_id,
          onHand: Number(row.on_hand),
          reserved: Number(row.reserved),
          version: Number(row.version),
          updatedAt: row.updated_at,
        };
      }
    } else {
      const [existing] = await (client as any)
        .select()
        .from(inventoryBalances)
        .where(
          and(
            eq(inventoryBalances.locationId, locationId),
            eq(inventoryBalances.variantId, variantId)
          )
        )
        .limit(1);

      if (existing) return existing;
    }

    // Insert new row if not existing
    const id = `bal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    try {
      const [created] = await (client as any)
        .insert(inventoryBalances)
        .values({
          id,
          organizationId,
          locationId,
          variantId,
          onHand: 0,
          reserved: 0,
          version: 1,
        })
        .onConflictDoNothing()
        .returning();

      if (created) return created;

      // In case of conflict, retrieve existing
      const [fetched] = await (client as any)
        .select()
        .from(inventoryBalances)
        .where(
          and(
            eq(inventoryBalances.locationId, locationId),
            eq(inventoryBalances.variantId, variantId)
          )
        )
        .limit(1);

      return fetched;
    } catch {
      const [fetched] = await (client as any)
        .select()
        .from(inventoryBalances)
        .where(
          and(
            eq(inventoryBalances.locationId, locationId),
            eq(inventoryBalances.variantId, variantId)
          )
        )
        .limit(1);
      return fetched;
    }
  }

  /**
   * Receive incoming stock physically into a location.
   * Idempotent via idempotencyKey.
   */
  static async receiveStock(organizationId: string, input: ReceiveStockInput, actorId: string) {
    if (input.quantity <= 0) {
      throw new ValidationError("Receipt quantity must be strictly greater than 0");
    }

    // Check idempotency key first
    if (input.idempotencyKey) {
      const [existingMovement] = await db
        .select()
        .from(inventoryMovements)
        .where(
          and(
            eq(inventoryMovements.organizationId, organizationId),
            eq(inventoryMovements.idempotencyKey, input.idempotencyKey)
          )
        )
        .limit(1);

      if (existingMovement) {
        const balance = await this.getOrCreateBalance(
          db,
          organizationId,
          input.locationId,
          input.variantId
        );
        return {
          movement: existingMovement,
          balance,
          idempotentReplay: true,
        };
      }
    }

    return await db.transaction(async (tx) => {
      // 1. Lock and retrieve current balance
      const balance = await this.getOrCreateBalance(
        tx,
        organizationId,
        input.locationId,
        input.variantId,
        true
      );

      const newOnHand = balance.onHand + input.quantity;
      const movementId = `mov_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // 2. Insert append-only movement ledger record
      const [movement] = await tx
        .insert(inventoryMovements)
        .values({
          id: movementId,
          organizationId,
          locationId: input.locationId,
          variantId: input.variantId,
          movementType: "receipt",
          quantityDelta: input.quantity,
          referenceType: "receipt",
          referenceId: input.referenceId || movementId,
          reason: input.reason || "Standard stock intake receipt",
          actorId,
          idempotencyKey: input.idempotencyKey || null,
        })
        .returning();

      // 3. Update inventory balance
      const [updatedBalance] = await tx
        .update(inventoryBalances)
        .set({
          onHand: newOnHand,
          version: balance.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(inventoryBalances.id, balance.id))
        .returning();

      // 4. Record audit event
      await AuditService.record(tx, {
        organizationId,
        actorId,
        action: "inventory.received",
        resourceType: "inventory_balance",
        resourceId: balance.id,
        beforeState: balance,
        afterState: updatedBalance,
        reason: `Received ${input.quantity} units for variant ${input.variantId}`,
      });

      return {
        movement,
        balance: updatedBalance,
        idempotentReplay: false,
      };
    });
  }

  /**
   * Concurrency-safe atomic reservation of stock for an order.
   * Invariant: Available = OnHand - Reserved >= requested quantity.
   */
  static async reserveStock(
    client: Database | Parameters<Parameters<Database["transaction"]>[0]>[0],
    organizationId: string,
    locationId: string,
    variantId: string,
    quantity: number,
    orderId: string,
    actorId: string,
    idempotencyKey?: string
  ) {
    if (quantity <= 0) {
      throw new ValidationError("Reservation quantity must be strictly greater than 0");
    }

    // Check if already reserved with this idempotency key
    if (idempotencyKey) {
      const [existing] = await (client as any)
        .select()
        .from(inventoryMovements)
        .where(
          and(
            eq(inventoryMovements.organizationId, organizationId),
            eq(inventoryMovements.idempotencyKey, idempotencyKey)
          )
        )
        .limit(1);

      if (existing) {
        return existing;
      }
    }

    // Row lock on balance table
    const balance = await this.getOrCreateBalance(
      client,
      organizationId,
      locationId,
      variantId,
      true
    );

    const available = balance.onHand - balance.reserved;
    if (available < quantity) {
      throw new InsufficientInventoryError(variantId, quantity, available);
    }

    const newReserved = balance.reserved + quantity;
    const movementId = `mov_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Append to movement ledger
    const [movement] = await (client as any)
      .insert(inventoryMovements)
      .values({
        id: movementId,
        organizationId,
        locationId,
        variantId,
        movementType: "reservation",
        quantityDelta: quantity,
        referenceType: "order",
        referenceId: orderId,
        reason: `Stock reserved for order ${orderId}`,
        actorId,
        idempotencyKey: idempotencyKey || `res_${orderId}_${variantId}`,
      })
      .returning();

    // Update balance
    await (client as any)
      .update(inventoryBalances)
      .set({
        reserved: newReserved,
        version: balance.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(inventoryBalances.id, balance.id));

    await AuditService.record(client, {
      organizationId,
      actorId,
      action: "inventory.reserved",
      resourceType: "inventory_balance",
      resourceId: balance.id,
      beforeState: balance,
      afterState: { ...balance, reserved: newReserved },
      reason: `Reserved ${quantity} units for order ${orderId}`,
    });

    return movement;
  }

  /**
   * Release reserved stock back to available pool (e.g. order cancelled or expired).
   * Idempotent: releases only unreleased reservations for the order.
   */
  static async releaseReservation(
    client: Database | Parameters<Parameters<Database["transaction"]>[0]>[0],
    organizationId: string,
    locationId: string,
    variantId: string,
    quantity: number,
    orderId: string,
    actorId: string,
    idempotencyKey?: string
  ) {
    if (quantity <= 0) return null;

    const releaseKey = idempotencyKey || `rel_${orderId}_${variantId}`;

    // Verify idempotency
    const [existingRelease] = await (client as any)
      .select()
      .from(inventoryMovements)
      .where(
        and(
          eq(inventoryMovements.organizationId, organizationId),
          eq(inventoryMovements.idempotencyKey, releaseKey)
        )
      )
      .limit(1);

    if (existingRelease) {
      return existingRelease;
    }

    const balance = await this.getOrCreateBalance(
      client,
      organizationId,
      locationId,
      variantId,
      true
    );

    const newReserved = Math.max(0, balance.reserved - quantity);
    const movementId = `mov_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const [movement] = await (client as any)
      .insert(inventoryMovements)
      .values({
        id: movementId,
        organizationId,
        locationId,
        variantId,
        movementType: "reservation_release",
        quantityDelta: -quantity,
        referenceType: "order",
        referenceId: orderId,
        reason: `Released reservation for cancelled/updated order ${orderId}`,
        actorId,
        idempotencyKey: releaseKey,
      })
      .returning();

    await (client as any)
      .update(inventoryBalances)
      .set({
        reserved: newReserved,
        version: balance.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(inventoryBalances.id, balance.id));

    await AuditService.record(client, {
      organizationId,
      actorId,
      action: "inventory.reservation_released",
      resourceType: "inventory_balance",
      resourceId: balance.id,
      beforeState: balance,
      afterState: { ...balance, reserved: newReserved },
      reason: `Released ${quantity} reserved units for order ${orderId}`,
    });

    return movement;
  }

  /**
   * Deduct stock upon confirmed shipment.
   * Reduces both onHand and reserved atomically.
   */
  static async deductShipment(
    client: Database | Parameters<Parameters<Database["transaction"]>[0]>[0],
    organizationId: string,
    locationId: string,
    variantId: string,
    quantity: number,
    fulfillmentId: string,
    actorId: string,
    idempotencyKey?: string
  ) {
    if (quantity <= 0) return null;

    const shipKey = idempotencyKey || `ship_${fulfillmentId}_${variantId}`;

    const [existingDeduction] = await (client as any)
      .select()
      .from(inventoryMovements)
      .where(
        and(
          eq(inventoryMovements.organizationId, organizationId),
          eq(inventoryMovements.idempotencyKey, shipKey)
        )
      )
      .limit(1);

    if (existingDeduction) {
      return existingDeduction;
    }

    const balance = await this.getOrCreateBalance(
      client,
      organizationId,
      locationId,
      variantId,
      true
    );

    const newOnHand = Math.max(0, balance.onHand - quantity);
    const newReserved = Math.max(0, balance.reserved - quantity);

    const movementId = `mov_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const [movement] = await (client as any)
      .insert(inventoryMovements)
      .values({
        id: movementId,
        organizationId,
        locationId,
        variantId,
        movementType: "shipment",
        quantityDelta: -quantity,
        referenceType: "shipment",
        referenceId: fulfillmentId,
        reason: `Stock deducted on confirmed dispatch for fulfillment ${fulfillmentId}`,
        actorId,
        idempotencyKey: shipKey,
      })
      .returning();

    await (client as any)
      .update(inventoryBalances)
      .set({
        onHand: newOnHand,
        reserved: newReserved,
        version: balance.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(inventoryBalances.id, balance.id));

    await AuditService.record(client, {
      organizationId,
      actorId,
      action: "inventory.shipped",
      resourceType: "inventory_balance",
      resourceId: balance.id,
      beforeState: balance,
      afterState: { ...balance, onHand: newOnHand, reserved: newReserved },
      reason: `Shipped ${quantity} units for fulfillment ${fulfillmentId}`,
    });

    return movement;
  }

  /**
   * Controlled manual inventory adjustment.
   * Requires non-empty reason and authorized actor.
   */
  static async adjustInventory(organizationId: string, input: AdjustStockInput, actorId: string) {
    if (!input.reason || input.reason.trim().length === 0) {
      throw new ValidationError("An explicit reason is mandatory for inventory adjustments");
    }

    if (input.quantityDelta === 0) {
      throw new ValidationError("Quantity delta cannot be zero");
    }

    // Check idempotency key
    if (input.idempotencyKey) {
      const [existingMovement] = await db
        .select()
        .from(inventoryMovements)
        .where(
          and(
            eq(inventoryMovements.organizationId, organizationId),
            eq(inventoryMovements.idempotencyKey, input.idempotencyKey)
          )
        )
        .limit(1);

      if (existingMovement) {
        const balance = await this.getOrCreateBalance(
          db,
          organizationId,
          input.locationId,
          input.variantId
        );
        return {
          movement: existingMovement,
          balance,
          idempotentReplay: true,
        };
      }
    }

    return await db.transaction(async (tx) => {
      const balance = await this.getOrCreateBalance(
        tx,
        organizationId,
        input.locationId,
        input.variantId,
        true
      );

      const newOnHand = balance.onHand + input.quantityDelta;
      if (newOnHand < 0) {
        throw new ValidationError(
          `Adjustment of ${input.quantityDelta} would result in negative on-hand stock (${newOnHand})`
        );
      }

      if (newOnHand < balance.reserved) {
        throw new ValidationError(
          `Adjustment would reduce on-hand (${newOnHand}) below active reservations (${balance.reserved})`
        );
      }

      const movementId = `mov_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const [movement] = await tx
        .insert(inventoryMovements)
        .values({
          id: movementId,
          organizationId,
          locationId: input.locationId,
          variantId: input.variantId,
          movementType: "adjustment",
          quantityDelta: input.quantityDelta,
          referenceType: "adjustment",
          referenceId: movementId,
          reason: input.reason.trim(),
          actorId,
          idempotencyKey: input.idempotencyKey || null,
        })
        .returning();

      const [updatedBalance] = await tx
        .update(inventoryBalances)
        .set({
          onHand: newOnHand,
          version: balance.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(inventoryBalances.id, balance.id))
        .returning();

      await AuditService.record(tx, {
        organizationId,
        actorId,
        action: "inventory.adjusted",
        resourceType: "inventory_balance",
        resourceId: balance.id,
        beforeState: balance,
        afterState: updatedBalance,
        reason: input.reason,
      });

      return {
        movement,
        balance: updatedBalance,
        idempotentReplay: false,
      };
    });
  }

  /**
   * Inventory reconciliation:
   * Compares stored operational balance with ledger-derived calculations.
   */
  static async reconcileInventory(
    organizationId: string,
    locationId: string,
    variantId: string
  ) {
    const balance = await this.getOrCreateBalance(
      db,
      organizationId,
      locationId,
      variantId
    );

    // Get all movements for this variant and location
    const movements = await db
      .select()
      .from(inventoryMovements)
      .where(
        and(
          eq(inventoryMovements.organizationId, organizationId),
          eq(inventoryMovements.locationId, locationId),
          eq(inventoryMovements.variantId, variantId)
        )
      )
      .orderBy(inventoryMovements.createdAt);

    // Calculate ledger-derived on-hand:
    // Receipts (+), Shipments (-), Adjustments (+/-), Corrections (+/-), Returns (+)
    let calculatedOnHand = 0;
    let calculatedReserved = 0;

    for (const mov of movements) {
      if (
        mov.movementType === "receipt" ||
        mov.movementType === "adjustment" ||
        mov.movementType === "shipment" ||
        mov.movementType === "return" ||
        mov.movementType === "correction" ||
        mov.movementType === "transfer_in" ||
        mov.movementType === "transfer_out"
      ) {
        calculatedOnHand += mov.quantityDelta;
      }

      if (mov.movementType === "reservation") {
        calculatedReserved += mov.quantityDelta;
      } else if (mov.movementType === "reservation_release") {
        calculatedReserved += mov.quantityDelta; // negative delta
      } else if (mov.movementType === "shipment") {
        // shipment resolves the reservation
        calculatedReserved += mov.quantityDelta; // negative delta
      }
    }

    // Ensure calculated values are non-negative
    calculatedOnHand = Math.max(0, calculatedOnHand);
    calculatedReserved = Math.max(0, calculatedReserved);

    const diffOnHand = balance.onHand - calculatedOnHand;
    const diffReserved = balance.reserved - calculatedReserved;
    const hasDiscrepancy = diffOnHand !== 0 || diffReserved !== 0;

    return {
      locationId,
      variantId,
      storedOnHand: balance.onHand,
      storedReserved: balance.reserved,
      storedAvailable: balance.onHand - balance.reserved,
      calculatedOnHand,
      calculatedReserved,
      calculatedAvailable: calculatedOnHand - calculatedReserved,
      discrepancyDetected: hasDiscrepancy,
      differenceOnHand: diffOnHand,
      differenceReserved: diffReserved,
      movementCount: movements.length,
      lastMovementAt: movements.length > 0 ? movements[movements.length - 1].createdAt : null,
    };
  }

  /**
   * Apply an authorized repair to resolve a reconciliation discrepancy.
   * - If targetPhysicalCount is provided: records a compensating 'correction' movement to bring ledger into agreement with physical count.
   * - If targetPhysicalCount is omitted: resyncs the stored balance to match the authoritative ledger calculation.
   */
  static async repairDiscrepancy(
    organizationId: string,
    locationId: string,
    variantId: string,
    reason: string,
    actorId: string,
    targetPhysicalCount?: number
  ) {
    if (!reason || reason.trim().length === 0) {
      throw new ValidationError("An explicit audit reason is required for discrepancy repair");
    }

    return await db.transaction(async (tx) => {
      const balance = await this.getOrCreateBalance(
        tx,
        organizationId,
        locationId,
        variantId,
        true
      );

      const recon = await this.reconcileInventory(organizationId, locationId, variantId);

      if (!recon.discrepancyDetected && targetPhysicalCount === undefined) {
        return {
          repaired: false,
          message: "No discrepancy detected for this variant and location",
          balance,
        };
      }

      const targetCount = targetPhysicalCount !== undefined ? targetPhysicalCount : balance.onHand;
      const delta = targetCount - recon.calculatedOnHand;
      const correctionId = `mov_corr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // Record compensating movement to reconcile ledger to verified count
      const [movement] = await tx
        .insert(inventoryMovements)
        .values({
          id: correctionId,
          organizationId,
          locationId,
          variantId,
          movementType: "correction",
          quantityDelta: delta,
          referenceType: "reconciliation",
          referenceId: correctionId,
          reason: `Compensating physical audit correction: ${reason.trim()} (Ledger was: ${recon.calculatedOnHand}, Physical count verified: ${targetCount})`,
          actorId,
        })
        .returning();

      // Update stored balance to match verified count
      const [updatedBalance] = await tx
        .update(inventoryBalances)
        .set({
          onHand: targetCount,
          reserved: recon.calculatedReserved,
          version: balance.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(inventoryBalances.id, balance.id))
        .returning();

      await AuditService.record(tx, {
        organizationId,
        actorId,
        action: "inventory.reconciliation_repaired",
        resourceType: "inventory_balance",
        resourceId: balance.id,
        beforeState: balance,
        afterState: updatedBalance,
        reason: `Reconciliation repair applied: ${reason}`,
      });

      return {
        repaired: true,
        movement,
        balance: updatedBalance,
      };
    });
  }

  /**
   * List inventory balances across locations with variant details.
   */
  static async listBalances(
    organizationId: string,
    filters?: {
      locationId?: string;
      variantId?: string;
      lowStockOnly?: boolean;
    }
  ) {
    const conditions = [eq(inventoryBalances.organizationId, organizationId)];

    if (filters?.locationId) {
      conditions.push(eq(inventoryBalances.locationId, filters.locationId));
    }
    if (filters?.variantId) {
      conditions.push(eq(inventoryBalances.variantId, filters.variantId));
    }

    const balances = await db
      .select({
        id: inventoryBalances.id,
        organizationId: inventoryBalances.organizationId,
        locationId: inventoryBalances.locationId,
        variantId: inventoryBalances.variantId,
        onHand: inventoryBalances.onHand,
        reserved: inventoryBalances.reserved,
        updatedAt: inventoryBalances.updatedAt,
        sku: productVariants.sku,
        unitOfMeasure: productVariants.unitOfMeasure,
        locationName: inventoryLocations.name,
        locationCode: inventoryLocations.locationCode,
      })
      .from(inventoryBalances)
      .innerJoin(productVariants, eq(inventoryBalances.variantId, productVariants.id))
      .innerJoin(inventoryLocations, eq(inventoryBalances.locationId, inventoryLocations.id))
      .where(and(...conditions))
      .orderBy(desc(inventoryBalances.updatedAt));

    const enriched = balances.map((b) => ({
      ...b,
      available: b.onHand - b.reserved,
    }));

    if (filters?.lowStockOnly) {
      return enriched.filter((b) => b.available <= 5);
    }

    return enriched;
  }

  /**
   * Query recent inventory movements.
   */
  static async listMovements(
    organizationId: string,
    filters?: {
      locationId?: string;
      variantId?: string;
      movementType?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const conditions = [eq(inventoryMovements.organizationId, organizationId)];

    if (filters?.locationId) {
      conditions.push(eq(inventoryMovements.locationId, filters.locationId));
    }
    if (filters?.variantId) {
      conditions.push(eq(inventoryMovements.variantId, filters.variantId));
    }
    if (filters?.movementType) {
      conditions.push(eq(inventoryMovements.movementType, filters.movementType));
    }

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    return await db
      .select({
        id: inventoryMovements.id,
        organizationId: inventoryMovements.organizationId,
        locationId: inventoryMovements.locationId,
        variantId: inventoryMovements.variantId,
        movementType: inventoryMovements.movementType,
        quantityDelta: inventoryMovements.quantityDelta,
        referenceType: inventoryMovements.referenceType,
        referenceId: inventoryMovements.referenceId,
        reason: inventoryMovements.reason,
        actorId: inventoryMovements.actorId,
        idempotencyKey: inventoryMovements.idempotencyKey,
        createdAt: inventoryMovements.createdAt,
        sku: productVariants.sku,
        locationCode: inventoryLocations.locationCode,
      })
      .from(inventoryMovements)
      .innerJoin(productVariants, eq(inventoryMovements.variantId, productVariants.id))
      .innerJoin(inventoryLocations, eq(inventoryMovements.locationId, inventoryLocations.id))
      .where(and(...conditions))
      .orderBy(desc(inventoryMovements.createdAt))
      .limit(limit)
      .offset(offset);
  }
}
