import { NextRequest } from "next/server";
import { withAuth } from "@/server/auth/route-guard";
import { CatalogService } from "@/server/services/catalog-service";
import { successResponse } from "@/server/errors/response-helper";
import { ValidationError } from "@/server/errors/app-error";

export const POST = withAuth(async (req, { auth, params }) => {
  const variantId = params.variantId as string;
  const body = await req.json();
  const { storeId, currency, amountMinor } = body;

  if (!storeId || !currency || amountMinor === undefined) {
    throw new ValidationError("storeId, currency, and amountMinor are required");
  }

  const price = await CatalogService.setProductPrice(
    auth.organizationId,
    storeId,
    variantId,
    currency,
    amountMinor,
    auth.userId
  );

  return successResponse(price, 201);
}, "canChangePrice");

