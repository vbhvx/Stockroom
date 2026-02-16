import { NextRequest } from "next/server";
import { withAuth } from "@/server/auth/route-guard";
import { CatalogService } from "@/server/services/catalog-service";
import { successResponse } from "@/server/errors/response-helper";

export const GET = withAuth(async (req, { auth, params }) => {
  const productId = params.productId as string;
  const product = await CatalogService.getProduct(auth.organizationId, productId);
  return successResponse(product);
});

export const PATCH = withAuth(async (req, { auth, params }) => {
  const productId = params.productId as string;
  const body = await req.json();
  const updated = await CatalogService.updateProduct(auth.organizationId, productId, body, auth.userId);
  return successResponse(updated);
}, "canManageCatalog");

