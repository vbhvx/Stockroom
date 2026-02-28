import { describe, it, expect } from "vitest";
import { PaymentService } from "@/server/services/payment-service";
import { OrderService } from "@/server/services/order-service";
import { CatalogService } from "@/server/services/catalog-service";
import { InventoryService } from "@/server/services/inventory-service";
import { defaultPaymentAdapter } from "@/server/integrations/payments/simulated-adapter";

describe("Payment Processing, Webhooks & Reconciliation", () => {
  const orgId = "org_stockroom_main";
  const storeId = "store_nyc";
  const locationId = "loc_nj_warehouse";
  const actorId = "usr_finance";

  it("initiates payment and advances pending order to confirmed upon capture", async () => {
    const product = await CatalogService.createProduct(
      orgId,
      { name: "Pay Product", slug: `pay-prod-${Date.now()}` },
      actorId
    );
    const variant = await CatalogService.createVariant(
      orgId,
      product.id,
      {
        sku: `PAY-SKU-${Date.now().toString().slice(-5)}`,
        price: { storeId, currency: "USD", amountMinor: 9900 },
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
        customerReference: "pay.test@example.com",
        lines: [{ variantId: variant.id, quantity: 1 }],
      },
      actorId
    );

    expect(order.orderStatus).toBe("pending");

    // Initiate payment
    const payment = await PaymentService.initiatePayment(
      orgId,
      { orderId: order.id },
      actorId
    );

    expect(payment.paymentStatus).toBe("captured");
    expect(payment.capturedAmountMinor).toBe(order.totalMinor);

    // Verify order was advanced to confirmed
    const updatedOrder = await OrderService.getOrderDetails(orgId, order.id);
    expect(updatedOrder.orderStatus).toBe("confirmed");
  });

  it("verifies webhook signatures and deduplicates repeated provider events", async () => {
    const product = await CatalogService.createProduct(
      orgId,
      { name: "Webhook Product", slug: `wh-prod-${Date.now()}` },
      actorId
    );
    const variant = await CatalogService.createVariant(
      orgId,
      product.id,
      {
        sku: `WH-SKU-${Date.now().toString().slice(-5)}`,
        price: { storeId, currency: "USD", amountMinor: 4500 },
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
        customerReference: "webhook@example.com",
        lines: [{ variantId: variant.id, quantity: 1 }],
      },
      actorId
    );

    // Initiate payment with simulated timeout (leaves it pending)
    const payment = await PaymentService.initiatePayment(
      orgId,
      { orderId: order.id, simulateTimeout: true },
      actorId
    );

    expect(payment.paymentStatus).toBe("pending");

    // Construct webhook payload
    const eventId = `evt_test_${Date.now()}`;
    const payload = JSON.stringify({
      eventId,
      eventType: "payment.captured",
      providerPaymentId: payment.providerPaymentId,
      orderId: order.id,
      status: "captured",
      amountMinor: order.totalMinor,
      currency: "USD",
      timestamp: new Date().toISOString(),
    });

    // 1. Invalid signature test
    await expect(
      PaymentService.processWebhook("simulated", payload, "v1=invalid_fake_signature")
    ).rejects.toThrow(/invalid webhook signature/i);

    // 2. Valid signature test
    const validSignature = defaultPaymentAdapter.generateWebhookSignature(payload);
    const result1 = await PaymentService.processWebhook("simulated", payload, validSignature);
    expect(result1.status).toBe("success");

    // 3. Duplicate event delivery test
    const result2 = await PaymentService.processWebhook("simulated", payload, validSignature);
    expect(result2.status).toBe("duplicate_ignored");
  });

  it("initiates refund with refundable balance verification", async () => {
    const product = await CatalogService.createProduct(
      orgId,
      { name: "Refund Product", slug: `ref-prod-${Date.now()}` },
      actorId
    );
    const variant = await CatalogService.createVariant(
      orgId,
      product.id,
      {
        sku: `REF-SKU-${Date.now().toString().slice(-5)}`,
        price: { storeId, currency: "USD", amountMinor: 10000 },
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
        customerReference: "refund@example.com",
        lines: [{ variantId: variant.id, quantity: 1 }],
      },
      actorId
    );

    const payment = await PaymentService.initiatePayment(orgId, { orderId: order.id }, actorId);
    expect(payment.paymentStatus).toBe("captured");

    // Partial refund of 4000
    const partialRefund = await PaymentService.initiateRefund(
      orgId,
      payment.id,
      {
        amountMinor: 4000,
        reason: "Customer partial return",
      },
      actorId
    );

    expect(partialRefund.status).toBe("succeeded");
    expect(partialRefund.amountMinor).toBe(4000);

    // Attempting to refund more than remaining balance (6000 left, asking 8000) must fail
    await expect(
      PaymentService.initiateRefund(
        orgId,
        payment.id,
        {
          amountMinor: 8000,
          reason: "Excessive refund",
        },
        actorId
      )
    ).rejects.toThrow(/exceeds remaining refundable balance/i);
  });
});

