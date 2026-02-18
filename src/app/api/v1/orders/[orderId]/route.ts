import { NextRequest } from "next/server";
import { withAuth } from "@/server/auth/route-guard";
import { OrderService } from "@/server/services/order-service";
import { successResponse } from "@/server/errors/response-helper";

export const GET = withAuth(async (req, { auth, params }) => {
  const orderId = params.orderId as string;
  const order = await OrderService.getOrderDetails(auth.organizationId, orderId);
  return successResponse(order);
}, "canViewOrder");

