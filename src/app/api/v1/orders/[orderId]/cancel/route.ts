import { NextRequest } from "next/server";
import { withAuth } from "@/server/auth/route-guard";
import { OrderService } from "@/server/services/order-service";
import { successResponse } from "@/server/errors/response-helper";
import { ValidationError } from "@/server/errors/app-error";

export const POST = withAuth(async (req, { auth, params }) => {
  const orderId = params.orderId as string;
  const body = await req.json();
  const { locationId, reason } = body;

  if (!locationId) {
    throw new ValidationError("locationId is required to return reserved stock on order cancellation");
  }

  const result = await OrderService.cancelOrder(
    auth.organizationId,
    orderId,
    locationId,
    reason || "Customer requested cancellation",
    auth.userId
  );

  return successResponse(result);
}, "canCancelOrder");

