import { describe, it, expect } from "vitest";
import { CatalogService } from "@/server/services/catalog-service";
import { InventoryService } from "@/server/services/inventory-service";
import { OrderService } from "@/server/services/order-service";
import { PaymentService } from "@/server/services/payment-service";
import { FulfillmentService } from "@/server/services/fulfillment-service";
import { AuditService } from "@/server/services/audit-service";
import { ReportingService } from "@/server/services/reporting-service";
import { assertPermission } from "@/server/authorization/roles";
import { db } from "@/db/client";

describe("Complete End-to-End Operational Workflow (14 Invariant Steps)", () => {
  const orgId = "org_stockroom_main";
  const orgB = "org_acme_retail";
  const storeId = "store_nyc";
  const locationId = "loc_nj_warehouse";

  it("executes the full lifecycle: Catalog -> Stock -> Order -> Payment -> Pick/Pack/Ship -> Refund -> Audit", async () => {
    // 1. Admin creates a product and sellable variant
    const testSku = `E2E-PROD-${Date.now().toString().slice(-6)}`;
    const product = await CatalogService.createProduct(
      orgId,
      {
        name: "E2E Performance Windbreaker",
        slug: `e2e-windbreaker-${Date.now()}`,
        brand: "Stockroom Techwear",
        status: "active",
      },
      "usr_admin"
    );

    const variant = await CatalogService.createVariant(
      orgId,
      product.id,
      {
        sku: testSku,
        barcode: "9988776655443",
        unitOfMeasure: "unit",
        price: {
          storeId,
          currency: "USD",
          amountMinor: 15000, // $150.00
        },
      },
      "usr_admin"
    );

    expect(product.id).toBeDefined();
    expect(variant.sku).toBe(testSku);

    // 2. Inventory Manager receives stock physically
    const receiptResult = await InventoryService.receiveStock(
      orgId,
      {
        locationId,
        variantId: variant.id,
        quantity: 50,
        reason: "Inbound container delivery",
      },
      "usr_inventory"
    );

    expect(receiptResult.balance.onHand).toBe(50);
    expect(receiptResult.balance.reserved).toBe(0);

    // 3. Dashboard shows resulting stock balance
    const summary = await ReportingService.getOperationalSummary(orgId);
    expect(summary).toBeDefined();

    // 4. An eligible order is created
    const order = await OrderService.createOrder(
      orgId,
      {
        storeId,
        locationId,
        customerReference: "e2e.customer@example.com",
        shippingMinor: 1200,
        lines: [{ variantId: variant.id, quantity: 2 }],
      },
      "usr_order"
    );

    expect(order.subtotalMinor).toBe(30000); // 2 * 15000
    expect(order.totalMinor).toBe(31200); // 30000 + 1200 shipping

    // 5. Inventory is reserved correctly
    let balance = await InventoryService.getOrCreateBalance(db, orgId, locationId, variant.id);
    expect(balance.onHand).toBe(50);
    expect(balance.reserved).toBe(2);
    expect(balance.onHand - balance.reserved).toBe(48); // 48 available

    // 6. Payment workflow enters captured state
    const payment = await PaymentService.initiatePayment(
      orgId,
      { orderId: order.id },
      "usr_finance"
    );
    expect(payment.paymentStatus).toBe("captured");
    expect(payment.capturedAmountMinor).toBe(31200);

    // Order status is automatically advanced to confirmed
    const confirmedOrder = await OrderService.getOrderDetails(orgId, order.id);
    expect(confirmedOrder.orderStatus).toBe("confirmed");

    // 7. Authorized operator processes fulfillment: picking -> packing
    const fulfillment = await FulfillmentService.createFulfillment(
      orgId,
      {
        orderId: order.id,
        locationId,
        lines: [{ orderLineId: order.lines[0].id, quantity: 2 }],
      },
      "usr_fulfillment"
    );
    expect(fulfillment.status).toBe("pending");

    const picking = await FulfillmentService.startPicking(orgId, fulfillment.id, "usr_fulfillment");
    expect(picking.status).toBe("picking");

    const packed = await FulfillmentService.packFulfillment(orgId, fulfillment.id, "usr_fulfillment");
    expect(packed.status).toBe("packed");

    // 8. Shipment confirmation changes inventory exactly once
    const shipResult = await FulfillmentService.shipFulfillment(
      orgId,
      fulfillment.id,
      { carrier: "FedEx Ground", trackingNumber: "FX-992817291" },
      "usr_fulfillment"
    );
    expect(shipResult.fulfillment.status).toBe("shipped");

    // Stock deduction check: On-hand should decrease from 50 to 48, Reserved from 2 to 0
    balance = await InventoryService.getOrCreateBalance(db, orgId, locationId, variant.id);
    expect(balance.onHand).toBe(48);
    expect(balance.reserved).toBe(0);
    expect(balance.onHand - balance.reserved).toBe(48);

    // Retrying shipment confirmation does NOT deduct stock a second time
    const retryShip = await FulfillmentService.shipFulfillment(
      orgId,
      fulfillment.id,
      {},
      "usr_fulfillment"
    );
    expect(retryShip.idempotentReplay).toBe(true);
    balance = await InventoryService.getOrCreateBalance(db, orgId, locationId, variant.id);
    expect(balance.onHand).toBe(48); // Still 48!

    // Order is now fulfilled
    const finalOrder = await OrderService.getOrderDetails(orgId, order.id);
    expect(finalOrder.orderStatus).toBe("fulfilled");

    // 9. Order history displays relevant transitions
    const activity = await AuditService.listEvents(orgId, { resourceId: order.id });
    expect(activity.length).toBeGreaterThan(0);

    // 10 & 11. Permitted finance user initiates refund reflecting provider outcome
    const refund = await PaymentService.initiateRefund(
      orgId,
      payment.id,
      {
        amountMinor: 15000, // Refund 1 item
        reason: "Customer courtesy concession",
      },
      "usr_finance"
    );
    expect(refund.status).toBe("succeeded");
    expect(refund.amountMinor).toBe(15000);

    // 12. A Viewer is denied inventory adjustment and refund actions
    expect(() => assertPermission("viewer", "canAdjustInventory")).toThrow(/Forbidden/);
    expect(() => assertPermission("viewer", "canInitiateRefund")).toThrow(/Forbidden/);

    // 13. A second organization cannot access the first organization's records
    await expect(
      OrderService.getOrderDetails(orgB, order.id)
    ).rejects.toThrow(/not found/i);

    // 14. An operational failure produces a reviewable error instead of corrupting state
    await expect(
      OrderService.transitionStatus(orgId, order.id, "pending", "Illegal reset", "usr_order")
    ).rejects.toThrow(/cannot transition order/i);
  });
});

