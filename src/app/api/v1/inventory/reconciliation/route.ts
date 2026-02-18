import { NextRequest } from "next/server";
import { withAuth } from "@/server/auth/route-guard";
import { InventoryService } from "@/server/services/inventory-service";
import { successResponse } from "@/server/errors/response-helper";
import { ValidationError } from "@/server/errors/app-error";

export const POST = withAuth(async (req, { auth }) => {
  const body = await req.json();
  const { locationId, variantId, repair, reason } = body;

  if (!locationId || !variantId) {
    throw new ValidationError("locationId and variantId are required for reconciliation");
  }

  if (repair) {
    if (!reason) {
      throw new ValidationError("An audit reason is required when repairing reconciliation discrepancies");
    }
    const repairResult = await InventoryService.repairDiscrepancy(
      auth.organizationId,
      locationId,
      variantId,
      reason,
      auth.userId
    );
    return successResponse(repairResult);
  }

  const report = await InventoryService.reconcileInventory(
    auth.organizationId,
    locationId,
    variantId
  );

  return successResponse(report);
}, "canAdjustInventory");

