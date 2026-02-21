import { NextRequest } from "next/server";
import { withAuth } from "@/server/auth/route-guard";
import { PaymentService } from "@/server/services/payment-service";
import { successResponse } from "@/server/errors/response-helper";

export const POST = withAuth(async (req, { auth }) => {
  const result = await PaymentService.reconcilePayments(auth.organizationId);
  return successResponse(result);
}, "canViewOrder");

