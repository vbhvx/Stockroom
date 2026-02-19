import crypto from "crypto";
import {
  PaymentProviderAdapter,
  CreatePaymentResult,
  CapturePaymentResult,
  CreateRefundResult,
  InternalPaymentStatus,
} from "./provider-adapter";

export class SimulatedPaymentAdapter implements PaymentProviderAdapter {
  readonly providerName = "simulated";
  private webhookSecret: string;

  // Track provider simulated state for status queries
  private providerRecords = new Map<
    string,
    {
      orderId: string;
      amountMinor: number;
      capturedAmountMinor: number;
      refundedAmountMinor: number;
      currency: string;
      status: InternalPaymentStatus;
    }
  >();

  constructor(secret?: string) {
    this.webhookSecret =
      secret ||
      process.env.PAYMENT_WEBHOOK_SECRET ||
      "whsec_stockroom_simulated_test_secret_key_99";
  }

  async initiatePayment(params: {
    orderId: string;
    amountMinor: number;
    currency: string;
    idempotencyKey?: string;
    simulateDecline?: boolean;
    simulateTimeout?: boolean;
  }): Promise<CreatePaymentResult> {
    const providerPaymentId = `sim_pay_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    if (params.simulateTimeout) {
      // Simulate timeout / pending state without immediate authoritative confirmation
      this.providerRecords.set(providerPaymentId, {
        orderId: params.orderId,
        amountMinor: params.amountMinor,
        capturedAmountMinor: 0,
        refundedAmountMinor: 0,
        currency: params.currency,
        status: "pending",
      });

      return {
        providerPaymentId,
        status: "pending",
        rawStatus: "requires_action",
      };
    }

    if (params.simulateDecline) {
      this.providerRecords.set(providerPaymentId, {
        orderId: params.orderId,
        amountMinor: params.amountMinor,
        capturedAmountMinor: 0,
        refundedAmountMinor: 0,
        currency: params.currency,
        status: "failed",
      });

      return {
        providerPaymentId,
        status: "failed",
        rawStatus: "do_not_honor",
        errorMessage: "Card declined: Insufficient funds or invalid card details",
      };
    }

    // Default: successful authorization and capture
    this.providerRecords.set(providerPaymentId, {
      orderId: params.orderId,
      amountMinor: params.amountMinor,
      capturedAmountMinor: params.amountMinor,
      refundedAmountMinor: 0,
      currency: params.currency,
      status: "captured",
    });

    return {
      providerPaymentId,
      status: "captured",
      rawStatus: "succeeded",
    };
  }

  async capturePayment(
    providerPaymentId: string,
    amountMinor: number
  ): Promise<CapturePaymentResult> {
    const record = this.providerRecords.get(providerPaymentId);
    if (!record) {
      throw new Error(`Provider payment not found: ${providerPaymentId}`);
    }

    record.capturedAmountMinor = amountMinor;
    record.status = "captured";

    return {
      providerPaymentId,
      status: "captured",
      capturedAmountMinor: amountMinor,
    };
  }

  async initiateRefund(params: {
    providerPaymentId: string;
    amountMinor: number;
    currency: string;
    reason: string;
    idempotencyKey?: string;
    simulateFailure?: boolean;
  }): Promise<CreateRefundResult> {
    const record = this.providerRecords.get(params.providerPaymentId);
    const providerRefundId = `sim_ref_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    if (params.simulateFailure) {
      return {
        providerRefundId,
        status: "failed",
        amountMinor: params.amountMinor,
        currency: params.currency,
        errorMessage: "Simulated refund failure from payment gateway",
      };
    }

    if (record) {
      record.refundedAmountMinor += params.amountMinor;
      if (record.refundedAmountMinor >= record.capturedAmountMinor) {
        record.status = "refunded";
      } else {
        record.status = "partially_refunded";
      }
    }

    return {
      providerRefundId,
      status: "succeeded",
      amountMinor: params.amountMinor,
      currency: params.currency,
    };
  }

  generateWebhookSignature(payloadString: string): string {
    const hmac = crypto.createHmac("sha256", this.webhookSecret);
    hmac.update(payloadString);
    return `t=${Math.floor(Date.now() / 1000)},v1=${hmac.digest("hex")}`;
  }

  verifyWebhookSignature(payloadString: string, signatureHeader: string): boolean {
    if (!signatureHeader) return false;

    try {
      const parts = signatureHeader.split(",");
      const sigPart = parts.find((p) => p.startsWith("v1="));
      if (!sigPart) return false;

      const receivedSig = sigPart.substring(3);
      const hmac = crypto.createHmac("sha256", this.webhookSecret);
      hmac.update(payloadString);
      const computedSig = hmac.digest("hex");

      return crypto.timingSafeEqual(
        Buffer.from(receivedSig, "hex"),
        Buffer.from(computedSig, "hex")
      );
    } catch {
      return false;
    }
  }

  async fetchProviderStatus(providerPaymentId: string) {
    const record = this.providerRecords.get(providerPaymentId);
    if (!record) {
      // Default fallback for simulated id
      return {
        providerPaymentId,
        status: "captured" as InternalPaymentStatus,
        capturedAmountMinor: 10000,
        refundedAmountMinor: 0,
      };
    }

    return {
      providerPaymentId,
      status: record.status,
      capturedAmountMinor: record.capturedAmountMinor,
      refundedAmountMinor: record.refundedAmountMinor,
    };
  }
}

export const defaultPaymentAdapter = new SimulatedPaymentAdapter();

