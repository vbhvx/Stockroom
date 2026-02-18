import { NextRequest } from "next/server";
import { withAuth } from "@/server/auth/route-guard";
import { InventoryService } from "@/server/services/inventory-service";
import { successResponse } from "@/server/errors/response-helper";

export const POST = withAuth(async (req, { auth }) => {
  const body = await req.json();
  const idempotencyKey = req.headers.get("x-idempotency-key") || body.idempotencyKey;

  const result = await InventoryService.receiveStock(
    auth.organizationId,
    {
      ...body,
      idempotencyKey,
    },
    auth.userId
  );

  return successResponse(result, 201);
}, "canReceiveStock");

