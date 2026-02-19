import { db } from "@/db/client";
import { payments, refunds, orders, providerEvents } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  ConflictError,
  NotFoundError,
  StateTransitionError,
  ValidationError,
  ForbiddenError,
} from "../errors/app-error";
import { AuditService } from "./audit-service";
import { defaultPaymentAdapter } from "../integrations/payments/simulated-adapter";
import { InternalPaymentStatus } from "../integrations/payments/provider-adapter";

export interface InitiatePaymentInput {
  orderId: string;
  provider?: string;
  idempotencyKey?: string;
  simulateDecline?: boolean;
  simulateTimeout?: boolean;
}

export interface InitiateRefundInput {
  amountMinor: number;
  reason: string;
  idempotencyKey?: string;
  simulateFailure?: boolean;
}

export class PaymentService {
  /**
   * Initiate a payment attempt for an order.
   */
  static async initiatePayment(
    organizationId: string,
    input: InitiatePaymentInput,
    actorId: string
  ) {
    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, input.orderId), eq(orders.organizationId, organizationId)))
      .limit(1);

    if (!order) {
      throw new NotFoundError("Order", input.orderId);
    }

    if (order.orderStatus === "cancelled") {
      throw new StateTransitionError("order", "cancelled", "paid");
    }

    // Check idempotency key if provided
    if (input.idempotencyKey) {
      const [existingPayment] = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.organizationId, organizationId),
            eq(payments.idempotencyKey, input.idempotencyKey)
          )
        )
        .limit(1);

      if (existingPayment) {
        return existingPayment;
      }
    }

    const adapter = defaultPaymentAdapter;
    const providerResult = await adapter.initiatePayment({
      orderId: order.id,
      amountMinor: order.totalMinor,
      currency: order.currency,
      idempotencyKey: input.idempotencyKey,
      simulateDecline: input.simulateDecline,
      simulateTimeout: input.simulateTimeout,
    });

    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return await db.transaction(async (tx) => {
      const isCaptured = providerResult.status === "captured";

      const [payment] = await tx
        .insert(payments)
        .values({
          id: paymentId,
          organizationId,
          orderId: order.id,
          provider: adapter.providerName,
          providerPaymentId: providerResult.providerPaymentId,
          paymentStatus: providerResult.status,
          currency: order.currency,
          authorizedAmountMinor: order.totalMinor,
          capturedAmountMinor: isCaptured ? order.totalMinor : 0,
          refundedAmountMinor: 0,
          idempotencyKey: input.idempotencyKey || null,
          errorMessage: providerResult.errorMessage || null,
        })
        .returning();

      // If captured and order is pending, advance order to confirmed or processing
      if (isCaptured && order.orderStatus === "pending") {
        await tx
          .update(orders)
          .set({
            orderStatus: "confirmed",
            updatedAt: new Date(),
          })
          .where(eq(orders.id, order.id));
      }

      await AuditService.record(tx, {
        organizationId,
        storeId: order.storeId,
        actorId,
        action: `payment.${providerResult.status}`,
        resourceType: "payment",
        resourceId: paymentId,
        afterState: payment,
        reason: `Payment attempt of ${order.totalMinor} (${order.currency}) result: ${providerResult.status}`,
      });

      return payment;
    });
  }

  /**
   * Process incoming payment provider webhook with cryptographic signature verification
   * and strict event deduplication.
   */
  static async processWebhook(
    provider: string,
    rawPayload: string,
    signatureHeader: string
  ) {
    const adapter = defaultPaymentAdapter;

    // 1. Verify signature
    const isValid = adapter.verifyWebhookSignature(rawPayload, signatureHeader);
    if (!isValid) {
      throw new ForbiddenError("Invalid webhook signature");
    }

    const event = JSON.parse(rawPayload);
    const eventId = event.eventId || `evt_${Date.now()}`;
    const providerPaymentId = event.providerPaymentId;
    const targetStatus = event.status as InternalPaymentStatus;

    // 2. Deduplicate event ID
    const [existingEvent] = await db
      .select()
      .from(providerEvents)
      .where(eq(providerEvents.providerEventId, eventId))
      .limit(1);

    if (existingEvent) {
      return {
        status: "duplicate_ignored",
        message: `Event '${eventId}' was already processed at ${existingEvent.processedAt}`,
      };
    }

    return await db.transaction(async (tx) => {
      // Record received event
      await tx.insert(providerEvents).values({
        id: `pevt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        provider,
        providerEventId: eventId,
        eventType: event.eventType || "payment.updated",
        payload: event,
        status: "received",
      });

      // Find internal payment
      const [payment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.providerPaymentId, providerPaymentId))
        .limit(1);

      if (!payment) {
        // Unknown payment, ignore safely without corrupting internal state
        return {
          status: "ignored_unknown_payment",
          providerPaymentId,
        };
      }

      // Transition payment status idempotently
      let newCaptured = payment.capturedAmountMinor;
      if (targetStatus === "captured") {
        newCaptured = event.amountMinor || payment.authorizedAmountMinor;
      }

      const [updatedPayment] = await tx
        .update(payments)
        .set({
          paymentStatus: targetStatus,
          capturedAmountMinor: newCaptured,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, payment.id))
        .returning();

      // If newly captured, check order status
      if (targetStatus === "captured") {
        const [order] = await tx
          .select()
          .from(orders)
          .where(eq(orders.id, payment.orderId))
          .limit(1);

        if (order && order.orderStatus === "pending") {
          await tx
            .update(orders)
            .set({ orderStatus: "confirmed", updatedAt: new Date() })
            .where(eq(orders.id, order.id));
        }
      }

      // Mark event as processed
      await tx
        .update(providerEvents)
        .set({
          status: "processed",
          processedAt: new Date(),
        })
        .where(eq(providerEvents.providerEventId, eventId));

      await AuditService.record(tx, {
        organizationId: payment.organizationId,
        actorId: `webhook:${provider}`,
        action: `payment.webhook.${targetStatus}`,
        resourceType: "payment",
        resourceId: payment.id,
        beforeState: payment,
        afterState: updatedPayment,
        reason: `Webhook processed event ${eventId}`,
      });

      return {
        status: "success",
        payment: updatedPayment,
      };
    });
  }

  /**
   * Initiate a refund with balance validation and idempotency.
   */
  static async initiateRefund(
    organizationId: string,
    paymentId: string,
    input: InitiateRefundInput,
    actorId: string
  ) {
    if (input.amountMinor <= 0) {
      throw new ValidationError("Refund amount must be strictly positive");
    }
    if (!input.reason || input.reason.trim().length === 0) {
      throw new ValidationError("An explicit reason is required to issue a refund");
    }

    const [payment] = await db
      .select()
      .from(payments)
      .where(and(eq(payments.id, paymentId), eq(payments.organizationId, organizationId)))
      .limit(1);

    if (!payment) {
      throw new NotFoundError("Payment", paymentId);
    }

    if (payment.paymentStatus !== "captured" && payment.paymentStatus !== "partially_refunded") {
      throw new ValidationError(
        `Cannot refund payment in status '${payment.paymentStatus}'. Must be 'captured' or 'partially_refunded'.`
      );
    }

    const refundableAmount = payment.capturedAmountMinor - payment.refundedAmountMinor;
    if (input.amountMinor > refundableAmount) {
      throw new ValidationError(
        `Requested refund of ${input.amountMinor} exceeds remaining refundable balance of ${refundableAmount}`
      );
    }

    // Check idempotency key
    if (input.idempotencyKey) {
      const [existingRefund] = await db
        .select()
        .from(refunds)
        .where(
          and(
            eq(refunds.organizationId, organizationId),
            eq(refunds.idempotencyKey, input.idempotencyKey)
          )
        )
        .limit(1);

      if (existingRefund) {
        return existingRefund;
      }
    }

    const adapter = defaultPaymentAdapter;
    const providerResult = await adapter.initiateRefund({
      providerPaymentId: payment.providerPaymentId || payment.id,
      amountMinor: input.amountMinor,
      currency: payment.currency,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      simulateFailure: input.simulateFailure,
    });

    const refundId = `ref_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return await db.transaction(async (tx) => {
      const [refundRecord] = await tx
        .insert(refunds)
        .values({
          id: refundId,
          organizationId,
          paymentId,
          providerRefundId: providerResult.providerRefundId,
          idempotencyKey: input.idempotencyKey || null,
          amountMinor: input.amountMinor,
          currency: payment.currency,
          status: providerResult.status,
          reason: input.reason.trim(),
          requestedBy: actorId,
        })
        .returning();

      if (providerResult.status === "succeeded") {
        const newRefunded = payment.refundedAmountMinor + input.amountMinor;
        const newStatus: InternalPaymentStatus =
          newRefunded >= payment.capturedAmountMinor ? "refunded" : "partially_refunded";

        await tx
          .update(payments)
          .set({
            refundedAmountMinor: newRefunded,
            paymentStatus: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(payments.id, payment.id));
      }

      await AuditService.record(tx, {
        organizationId,
        actorId,
        action: `payment.refund.${providerResult.status}`,
        resourceType: "refund",
        resourceId: refundId,
        afterState: refundRecord,
        reason: `Refund requested for ${input.amountMinor} (${payment.currency}): ${input.reason}`,
      });

      return refundRecord;
    });
  }

  /**
   * Payment reconciliation service:
   * Compares internal payment records with authoritative provider records,
   * detecting timeouts, missing webhooks, or amount discrepancies.
   */
  static async reconcilePayments(organizationId: string) {
    const pendingPayments = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.organizationId, organizationId),
          eq(payments.paymentStatus, "pending")
        )
      );

    const adapter = defaultPaymentAdapter;
    const discrepancies: Array<{
      paymentId: string;
      providerPaymentId: string | null;
      internalStatus: string;
      providerStatus: string;
      resolution: string;
    }> = [];

    let resolvedCount = 0;

    for (const payment of pendingPayments) {
      if (!payment.providerPaymentId) continue;

      const providerData = await adapter.fetchProviderStatus(payment.providerPaymentId);

      if (providerData.status !== "pending") {
        // Discrepancy detected! Provider confirmed success or failure, but webhook was lost
        await db.transaction(async (tx) => {
          await tx
            .update(payments)
            .set({
              paymentStatus: providerData.status,
              capturedAmountMinor: providerData.capturedAmountMinor,
              updatedAt: new Date(),
            })
            .where(eq(payments.id, payment.id));

          if (providerData.status === "captured") {
            const [order] = await tx
              .select()
              .from(orders)
              .where(eq(orders.id, payment.orderId))
              .limit(1);

            if (order && order.orderStatus === "pending") {
              await tx
                .update(orders)
                .set({ orderStatus: "confirmed", updatedAt: new Date() })
                .where(eq(orders.id, order.id));
            }
          }

          await AuditService.record(tx, {
            organizationId,
            actorId: "system:reconciliation",
            action: "payment.reconciled",
            resourceType: "payment",
            resourceId: payment.id,
            reason: `Reconciliation updated status from 'pending' to '${providerData.status}' based on authoritative provider data`,
          });
        });

        discrepancies.push({
          paymentId: payment.id,
          providerPaymentId: payment.providerPaymentId,
          internalStatus: "pending",
          providerStatus: providerData.status,
          resolution: `Updated internal status to '${providerData.status}'`,
        });

        resolvedCount++;
      }
    }

    return {
      totalScanned: pendingPayments.length,
      discrepanciesFound: discrepancies.length,
      resolvedCount,
      discrepancies,
    };
  }

  /**
   * List payments for an organization or order.
   */
  static async listPayments(organizationId: string, orderId?: string) {
    const conditions = [eq(payments.organizationId, organizationId)];
    if (orderId) {
      conditions.push(eq(payments.orderId, orderId));
    }

    const items = await db
      .select()
      .from(payments)
      .where(and(...conditions))
      .orderBy(desc(payments.createdAt));

    return items;
  }
}

