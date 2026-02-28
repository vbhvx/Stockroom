import { describe, it, expect } from "vitest";
import { OrderService } from "@/server/services/order-service";
import { CatalogService } from "@/server/services/catalog-service";
import { InventoryService } from "@/server/services/inventory-service";
import { db } from "@/db/client";

describe("Order Management Lifecycle Tests", () => {
  const orgId = "org_stockroom_main";
  const storeId = "store_nyc";
  const locationId = "loc_nj_warehouse";
  const actorId = "usr_order";

  it("creates order, snapshots lines, and atomically reserves stock", async () => {
    // Setup test variant
    const product = await CatalogService.createProduct(
      orgId,
      { name: "Order Test Jacket", slug: `ord-test-${Date.now()}` },
      actorId
    );
    const variant = await CatalogService.createVariant(
      orgId,
      product.id,
      {
        sku: `ORD-JCK-${Date.now().toString().slice(-5)}`,
        price: {
          storeId,
          currency: "USD",
          amountMinor: 20000, // $200.00
        },
      },
      actorId
    );

    // Stock up 10 units
    await InventoryService.receiveStock(
      orgId,
      { locationId, variantId: variant.id, quantity: 10 },
      actorId
    );

    // Create order for 3 units
    const order = await OrderService.createOrder(
      orgId,
      {
        storeId,
        locationId,
        customerReference: "john.doe@example.com",
        shippingMinor: 1500,
        lines: [{ variantId: variant.id, quantity: 3 }],
      },
      actorId
    );

    expect(order.orderNumber).toBeDefined();
    expect(order.subtotalMinor).toBe(60000); // 3 * 20000
    expect(order.totalMinor).toBe(61500); // 60000 + 1500 shipping
    expect(order.lines[0].skuSnapshot).toBe(variant.sku);
    expect(order.lines[0].unitPriceMinor).toBe(20000);

    // Verify stock reserved
    const balance = await InventoryService.getOrCreateBalance(
      db,
      orgId,
      locationId,
      variant.id
    );
    expect(balance.onHand).toBe(10);
    expect(balance.reserved).toBe(3);
    expect(balance.onHand - balance.reserved).toBe(7); // 7 available

    // Verify changing product price later DOES NOT change existing order snapshot!
    await CatalogService.setProductPrice(
      orgId,
      storeId,
      variant.id,
      "USD",
      35000, // Price increases to $350.00
      actorId
    );

    const reloadedOrder = await OrderService.getOrderDetails(orgId, order.id);
    expect(reloadedOrder.totalMinor).toBe(61500); // Unchanged!
    expect(reloadedOrder.lines[0].unitPriceMinor).toBe(20000); // Snapshot preserved!
  });

  it("transitions order status and rejects forbidden transitions", async () => {
    const product = await CatalogService.createProduct(
      orgId,
      { name: "Transition Product", slug: `trans-prod-${Date.now()}` },
      actorId
    );
    const variant = await CatalogService.createVariant(
      orgId,
      product.id,
      {
        sku: `TRANS-${Date.now().toString().slice(-5)}`,
        price: { storeId, currency: "USD", amountMinor: 5000 },
      },
      actorId
    );
    await InventoryService.receiveStock(
      orgId,
      { locationId, variantId: variant.id, quantity: 5 },
      actorId
    );

    const order = await OrderService.createOrder(
      orgId,
      {
        storeId,
        locationId,
        customerReference: "test@example.com",
        lines: [{ variantId: variant.id, quantity: 1 }],
      },
      actorId
    );

    expect(order.orderStatus).toBe("pending");

    // Valid: pending -> confirmed
    const confirmed = await OrderService.transitionStatus(
      orgId,
      order.id,
      "confirmed",
      "Payment validated",
      actorId
    );
    expect(confirmed.orderStatus).toBe("confirmed");

    // Valid: confirmed -> processing
    const processing = await OrderService.transitionStatus(
      orgId,
      order.id,
      "processing",
      "Sent to warehouse floor",
      actorId
    );
    expect(processing.orderStatus).toBe("processing");

    // Invalid: processing -> pending (not allowed)
    await expect(
      OrderService.transitionStatus(orgId, order.id, "pending", "Illegal move", actorId)
    ).rejects.toThrow(/cannot transition order/i);
  });

  it("cancels order and safely releases reserved stock back to available pool", async () => {
    const product = await CatalogService.createProduct(
      orgId,
      { name: "Cancel Order Product", slug: `cncl-prod-${Date.now()}` },
      actorId
    );
    const variant = await CatalogService.createVariant(
      orgId,
      product.id,
      {
        sku: `CNCL-${Date.now().toString().slice(-5)}`,
        price: { storeId, currency: "USD", amountMinor: 7500 },
      },
      actorId
    );
    await InventoryService.receiveStock(
      orgId,
      { locationId, variantId: variant.id, quantity: 10 },
      actorId
    );

    const order = await OrderService.createOrder(
      orgId,
      {
        storeId,
        locationId,
        customerReference: "cancel.test@example.com",
        lines: [{ variantId: variant.id, quantity: 4 }],
      },
      actorId
    );

    // Initial check: 4 reserved
    let balance = await InventoryService.getOrCreateBalance(db, orgId, locationId, variant.id);
    expect(balance.reserved).toBe(4);

    // Cancel order
    const cancelResult = await OrderService.cancelOrder(
      orgId,
      order.id,
      locationId,
      "Customer cancelled prior to shipment",
      actorId
    );
    expect(cancelResult.order.orderStatus).toBe("cancelled");

    // Reserved stock must be released back to 0!
    balance = await InventoryService.getOrCreateBalance(db, orgId, locationId, variant.id);
    expect(balance.reserved).toBe(0);
    expect(balance.onHand - balance.reserved).toBe(10); // All 10 available again
  });
});

