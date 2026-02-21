import { NextRequest } from "next/server";
import { withAuth } from "@/server/auth/route-guard";
import { FulfillmentService } from "@/server/services/fulfillment-service";
import { successResponse } from "@/server/errors/response-helper";
import { ValidationError } from "@/server/errors/app-error";

export const POST = withAuth(async (req, { auth, params }) => {
  const fulfillmentId = params.fulfillmentId as string;
  const body = await req.json();
  const { exceptionType, reason } = body;

  if (!exceptionType || !reason) {
    throw new ValidationError("exceptionType and reason are required");
  }

  const exception = await FulfillmentService.logException(
    auth.organizationId,
    fulfillmentId,
    exceptionType,
    reason,
    auth.userId
  );

  return successResponse(exception, 201);
});

