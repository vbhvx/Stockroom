import { NextRequest } from "next/server";
import { withAuth } from "@/server/auth/route-guard";
import { FulfillmentService } from "@/server/services/fulfillment-service";
import { successResponse } from "@/server/errors/response-helper";

export const GET = withAuth(async (req, { auth, params }) => {
  const orderId = params.orderId as string;
  const fulfillments = await FulfillmentService.listFulfillments(auth.organizationId, orderId);
  return successResponse(fulfillments);
}, "canViewOrder");

export const POST = withAuth(async (req, { auth, params }) => {
  const orderId = params.orderId as string;
  const body = await req.json();

  const fulfillment = await FulfillmentService.createFulfillment(
    auth.organizationId,
    {
      orderId,
      ...body,
    },
    auth.userId
  );

  return successResponse(fulfillment, 201);
}, "canDispatchFulfillment");

