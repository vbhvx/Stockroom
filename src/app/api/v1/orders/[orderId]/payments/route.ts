import { NextRequest } from "next/server";
import { withAuth } from "@/server/auth/route-guard";
import { PaymentService } from "@/server/services/payment-service";
import { successResponse } from "@/server/errors/response-helper";

export const GET = withAuth(async (req, { auth, params }) => {
  const orderId = params.orderId as string;
  const list = await PaymentService.listPayments(auth.organizationId, orderId);
  return successResponse(list);
}, "canViewOrder");

export const POST = withAuth(async (req, { auth, params }) => {
  const orderId = params.orderId as string;
  const body = await req.json().catch(() => ({}));
  const idempotencyKey = req.headers.get("x-idempotency-key") || body.idempotencyKey;

  const payment = await PaymentService.initiatePayment(
    auth.organizationId,
    {
      orderId,
      ...body,
      idempotencyKey,
    },
    auth.userId
  );

  return successResponse(payment, 201);
});

