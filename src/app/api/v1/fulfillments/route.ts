import { NextRequest } from "next/server";
import { withAuth } from "@/server/auth/route-guard";
import { FulfillmentService } from "@/server/services/fulfillment-service";
import { successResponse } from "@/server/errors/response-helper";

export const GET = withAuth(async (req, { auth }) => {
  const fulfillments = await FulfillmentService.listFulfillments(auth.organizationId);
  return successResponse(fulfillments);
}, "canViewOrder");

