import { NextRequest } from "next/server";
import { withAuth } from "@/server/auth/route-guard";
import { FulfillmentService } from "@/server/services/fulfillment-service";
import { successResponse } from "@/server/errors/response-helper";

export const POST = withAuth(async (req, { auth, params }) => {
  const fulfillmentId = params.fulfillmentId as string;
  const body = await req.json().catch(() => ({}));
  const idempotencyKey = req.headers.get("x-idempotency-key") || body.idempotencyKey;

  const result = await FulfillmentService.shipFulfillment(
    auth.organizationId,
    fulfillmentId,
    {
      carrier: body.carrier,
      trackingNumber: body.trackingNumber,
      idempotencyKey,
    },
    auth.userId
  );

  return successResponse(result);
}, "canDispatchFulfillment");

