import { describe, it, expect } from "vitest";
import { InventoryService } from "@/server/services/inventory-service";
import { CatalogService } from "@/server/services/catalog-service";
import { db } from "@/db/client";

describe("Inventory Ledger & Concurrency Tests", () => {
  const orgId = "org_stockroom_main";
  const locationId = "loc_nj_warehouse";
  const actorId = "usr_inventory";

  it("receives stock into location and updates on-hand", async () => {
    // Create new variant
    const product = await CatalogService.createProduct(
      orgId,
      { name: "Inv Test Product", slug: `inv-test-${Date.now()}` },
      actorId
    );
    const variant = await CatalogService.createVariant(
      orgId,
      product.id,
      { sku: `INV-SKU-${Date.now().toString().slice(-6)}` },
      actorId
    );

    const result = await InventoryService.receiveStock(
      orgId,
      {
        locationId,
        variantId: variant.id,
        quantity: 50,
        reason: "Test initial intake",
      },
      actorId
    );

    expect(result.balance.onHand).toBe(50);
    expect(result.balance.reserved).toBe(0);
    expect(result.movement.movementType).toBe("receipt");
  });

  it("prevents double-counting when repeating stock receipt with identical idempotency key", async () => {
    const product = await CatalogService.createProduct(
      orgId,
      { name: "Idempotency Intake Product", slug: `idemp-intake-${Date.now()}` },
      actorId
    );
    const variant = await CatalogService.createVariant(
      orgId,
      product.id,
      { sku: `IDEMP-SKU-${Date.now().toString().slice(-6)}` },
      actorId
    );

    const idempotencyKey = `idemp_receipt_key_${Date.now()}`;

    // First call
    const first = await InventoryService.receiveStock(
      orgId,
      {
        locationId,
        variantId: variant.id,
        quantity: 30,
        idempotencyKey,
      },
      actorId
    );

    expect(first.balance.onHand).toBe(30);
    expect(first.idempotentReplay).toBe(false);

    // Second repeated call with identical key
    const second = await InventoryService.receiveStock(
      orgId,
      {
        locationId,
        variantId: variant.id,
        quantity: 30,
        idempotencyKey,
      },
      actorId
    );

    expect(second.balance.onHand).toBe(30); // NOT 60!
    expect(second.idempotentReplay).toBe(true);
  });

  it("atomically reserves stock and rejects overselling beyond available quantity", async () => {
    const product = await CatalogService.createProduct(
      orgId,
      { name: "Reserve Product", slug: `res-prod-${Date.now()}` },
      actorId
    );
    const variant = await CatalogService.createVariant(
      orgId,
      product.id,
      { sku: `RES-SKU-${Date.now().toString().slice(-6)}` },
      actorId
    );

    // Receive 10 units
    await InventoryService.receiveStock(
      orgId,
      { locationId, variantId: variant.id, quantity: 10 },
      actorId
    );

    // Reserve 6 units
    await InventoryService.reserveStock(
      db,
      orgId,
      locationId,
      variant.id,
      6,
      "ord_test_001",
      actorId
    );

    const balance = await InventoryService.getOrCreateBalance(
      db,
      orgId,
      locationId,
      variant.id
    );
    expect(balance.onHand).toBe(10);
    expect(balance.reserved).toBe(6);
    expect(balance.onHand - balance.reserved).toBe(4); // 4 available

    // Attempting to reserve 5 units must fail because only 4 are available
    await expect(
      InventoryService.reserveStock(
        db,
        orgId,
        locationId,
        variant.id,
        5,
        "ord_test_002",
        actorId
      )
    ).rejects.toThrow(/insufficient available inventory/i);
  });

  it("releases reserved inventory on cancellation and prevents double-release", async () => {
    const product = await CatalogService.createProduct(
      orgId,
      { name: "Release Product", slug: `rel-prod-${Date.now()}` },
      actorId
    );
    const variant = await CatalogService.createVariant(
      orgId,
      product.id,
      { sku: `REL-SKU-${Date.now().toString().slice(-6)}` },
      actorId
    );

    await InventoryService.receiveStock(
      orgId,
      { locationId, variantId: variant.id, quantity: 20 },
      actorId
    );

    const testOrderId = `ord_rel_test_${Date.now()}`;

    // Reserve 5 units
    await InventoryService.reserveStock(
      db,
      orgId,
      locationId,
      variant.id,
      5,
      testOrderId,
      actorId
    );

    let balance = await InventoryService.getOrCreateBalance(
      db,
      orgId,
      locationId,
      variant.id
    );
    expect(balance.reserved).toBe(5);

    // Release 5 units
    await InventoryService.releaseReservation(
      db,
      orgId,
      locationId,
      variant.id,
      5,
      testOrderId,
      actorId
    );

    balance = await InventoryService.getOrCreateBalance(
      db,
      orgId,
      locationId,
      variant.id
    );
    expect(balance.reserved).toBe(0);

    // Repeating release with the same key must be idempotent
    await InventoryService.releaseReservation(
      db,
      orgId,
      locationId,
      variant.id,
      5,
      testOrderId,
      actorId
    );

    balance = await InventoryService.getOrCreateBalance(
      db,
      orgId,
      locationId,
      variant.id
    );
    expect(balance.reserved).toBe(0); // Remains 0, does not go negative!
  });

  it("deducts both on-hand and reserved on shipment confirmation exactly once", async () => {
    const product = await CatalogService.createProduct(
      orgId,
      { name: "Ship Product", slug: `ship-prod-${Date.now()}` },
      actorId
    );
    const variant = await CatalogService.createVariant(
      orgId,
      product.id,
      { sku: `SHIP-SKU-${Date.now().toString().slice(-6)}` },
      actorId
    );

    await InventoryService.receiveStock(
      orgId,
      { locationId, variantId: variant.id, quantity: 25 },
      actorId
    );

    const orderId = `ord_ship_${Date.now()}`;
    const fulfillmentId = `ful_ship_${Date.now()}`;

    await InventoryService.reserveStock(
      db,
      orgId,
      locationId,
      variant.id,
      5,
      orderId,
      actorId
    );

    // Deduct shipment
    await InventoryService.deductShipment(
      db,
      orgId,
      locationId,
      variant.id,
      5,
      fulfillmentId,
      actorId
    );

    const balance = await InventoryService.getOrCreateBalance(
      db,
      orgId,
      locationId,
      variant.id
    );
    expect(balance.onHand).toBe(20); // 25 - 5
    expect(balance.reserved).toBe(0); // 5 - 5

    // Retrying shipment deduction with same key does not double-deduct
    await InventoryService.deductShipment(
      db,
      orgId,
      locationId,
      variant.id,
      5,
      fulfillmentId,
      actorId
    );

    const balanceAfterRetry = await InventoryService.getOrCreateBalance(
      db,
      orgId,
      locationId,
      variant.id
    );
    expect(balanceAfterRetry.onHand).toBe(20);
    expect(balanceAfterRetry.reserved).toBe(0);
  });

  it("adjusts inventory with mandatory reason and blocks adjustments causing negative stock", async () => {
    const product = await CatalogService.createProduct(
      orgId,
      { name: "Adjust Product", slug: `adj-prod-${Date.now()}` },
      actorId
    );
    const variant = await CatalogService.createVariant(
      orgId,
      product.id,
      { sku: `ADJ-SKU-${Date.now().toString().slice(-6)}` },
      actorId
    );

    await InventoryService.receiveStock(
      orgId,
      { locationId, variantId: variant.id, quantity: 10 },
      actorId
    );

    // Valid adjustment: +5 units
    const adjResult = await InventoryService.adjustInventory(
      orgId,
      {
        locationId,
        variantId: variant.id,
        quantityDelta: 5,
        reason: "Cycle count audit found extra units",
      },
      actorId
    );
    expect(adjResult.balance.onHand).toBe(15);

    // Adjusting without a reason is rejected
    await expect(
      InventoryService.adjustInventory(
        orgId,
        {
          locationId,
          variantId: variant.id,
          quantityDelta: -2,
          reason: "",
        },
        actorId
      )
    ).rejects.toThrow(/explicit reason is mandatory/i);

    // Adjusting below 0 is rejected
    await expect(
      InventoryService.adjustInventory(
        orgId,
        {
          locationId,
          variantId: variant.id,
          quantityDelta: -20,
          reason: "Damaged inventory discard",
        },
        actorId
      )
    ).rejects.toThrow(/negative on-hand stock/i);
  });
});

