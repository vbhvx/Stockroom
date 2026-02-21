import { NextRequest } from "next/server";
import { withAuth } from "@/server/auth/route-guard";
import { FulfillmentService } from "@/server/services/fulfillment-service";
import { successResponse } from "@/server/errors/response-helper";

export const POST = withAuth(async (req, { auth, params }) => {
  const fulfillmentId = params.fulfillmentId as string;
  const updated = await FulfillmentService.startPicking(auth.organizationId, fulfillmentId, auth.userId);
  return successResponse(updated);
}, "canDispatchFulfillment");

