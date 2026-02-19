export type InternalPaymentStatus =
  | "pending"
  | "authorized"
  | "captured"
  | "failed"
  | "cancelled"
  | "partially_refunded"
  | "refunded";

export interface CreatePaymentResult {
  providerPaymentId: string;
  status: InternalPaymentStatus;
  rawStatus: string;
  errorMessage?: string;
}

export interface CapturePaymentResult {
  providerPaymentId: string;
  status: InternalPaymentStatus;
  capturedAmountMinor: number;
}

export interface CreateRefundResult {
  providerRefundId: string;
  status: "succeeded" | "pending" | "failed" | "uncertain";
  amountMinor: number;
  currency: string;
  errorMessage?: string;
}

export interface WebhookEventPayload {
  eventId: string;
  eventType: string;
  providerPaymentId: string;
  orderId?: string;
  status: InternalPaymentStatus;
  amountMinor: number;
  currency: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentProviderAdapter {
  readonly providerName: string;

  initiatePayment(params: {
    orderId: string;
    amountMinor: number;
    currency: string;
    idempotencyKey?: string;
    simulateDecline?: boolean;
    simulateTimeout?: boolean;
  }): Promise<CreatePaymentResult>;

  capturePayment(providerPaymentId: string, amountMinor: number): Promise<CapturePaymentResult>;

  initiateRefund(params: {
    providerPaymentId: string;
    amountMinor: number;
    currency: string;
    reason: string;
    idempotencyKey?: string;
    simulateFailure?: boolean;
  }): Promise<CreateRefundResult>;

  verifyWebhookSignature(payloadString: string, signatureHeader: string): boolean;

  fetchProviderStatus(providerPaymentId: string): Promise<{
    providerPaymentId: string;
    status: InternalPaymentStatus;
    capturedAmountMinor: number;
    refundedAmountMinor: number;
  }>;
}

