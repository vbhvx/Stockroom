import { NextRequest } from "next/server";
import { withAuth } from "@/server/auth/route-guard";
import { InventoryService } from "@/server/services/inventory-service";
import { successResponse } from "@/server/errors/response-helper";

export const GET = withAuth(async (req, { auth }) => {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("locationId") || undefined;
  const variantId = searchParams.get("variantId") || undefined;
  const lowStockOnly = searchParams.get("lowStock") === "true";

  const balances = await InventoryService.listBalances(auth.organizationId, {
    locationId,
    variantId,
    lowStockOnly,
  });

  return successResponse(balances);
});

