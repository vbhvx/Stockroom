import { NextRequest } from "next/server";
import { withAuth } from "@/server/auth/route-guard";
import { PaymentService } from "@/server/services/payment-service";
import { successResponse } from "@/server/errors/response-helper";

export const POST = withAuth(async (req, { auth, params }) => {
  const paymentId = params.paymentId as string;
  const body = await req.json();
  const idempotencyKey = req.headers.get("x-idempotency-key") || body.idempotencyKey;

  const refund = await PaymentService.initiateRefund(
    auth.organizationId,
    paymentId,
    {
      ...body,
      idempotencyKey,
    },
    auth.userId
  );

  return successResponse(refund, 201);
}, "canInitiateRefund");

