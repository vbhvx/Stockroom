import { NextRequest } from "next/server";
import { withAuth } from "@/server/auth/route-guard";
import { CatalogService } from "@/server/services/catalog-service";
import { successResponse } from "@/server/errors/response-helper";

export const POST = withAuth(async (req, { auth, params }) => {
  const productId = params.productId as string;
  const body = await req.json();
  const variant = await CatalogService.createVariant(auth.organizationId, productId, body, auth.userId);
  return successResponse(variant, 201);
}, "canManageCatalog");

