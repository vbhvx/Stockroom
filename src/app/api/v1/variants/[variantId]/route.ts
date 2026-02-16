import { NextRequest } from "next/server";
import { withAuth } from "@/server/auth/route-guard";
import { CatalogService } from "@/server/services/catalog-service";
import { successResponse } from "@/server/errors/response-helper";

export const PATCH = withAuth(async (req, { auth, params }) => {
  const variantId = params.variantId as string;
  const body = await req.json();
  const updated = await CatalogService.updateVariant(auth.organizationId, variantId, body, auth.userId);
  return successResponse(updated);
}, "canManageCatalog");

