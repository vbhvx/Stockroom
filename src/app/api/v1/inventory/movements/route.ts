import { NextRequest } from "next/server";
import { withAuth } from "@/server/auth/route-guard";
import { InventoryService } from "@/server/services/inventory-service";
import { successResponse } from "@/server/errors/response-helper";

export const GET = withAuth(async (req, { auth }) => {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("locationId") || undefined;
  const variantId = searchParams.get("variantId") || undefined;
  const movementType = searchParams.get("movementType") || undefined;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;
  const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;

  const movements = await InventoryService.listMovements(auth.organizationId, {
    locationId,
    variantId,
    movementType,
    limit,
    offset,
  });

  return successResponse(movements);
});

