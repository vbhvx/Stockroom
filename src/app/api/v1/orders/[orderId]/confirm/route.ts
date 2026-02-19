import { NextRequest } from "next/server";
import { withAuth } from "@/server/auth/route-guard";
import { OrderService } from "@/server/services/order-service";
import { successResponse } from "@/server/errors/response-helper";

export const POST = withAuth(async (req, { auth, params }) => {
  const orderId = params.orderId as string;
  const body = await req.json().catch(() => ({}));
  const reason = body.reason || "Order confirmed by staff";

  const updated = await OrderService.transitionStatus(
    auth.organizationId,
    orderId,
    "confirmed",
    reason,
    auth.userId
  );

  return successResponse(updated);
}, "canViewOrder");

