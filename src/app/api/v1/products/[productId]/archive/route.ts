import { NextRequest } from "next/server";
import { withAuth } from "@/server/auth/route-guard";
import { CatalogService } from "@/server/services/catalog-service";
import { successResponse } from "@/server/errors/response-helper";

export const POST = withAuth(async (req, { auth, params }) => {
  const productId = params.productId as string;
  const archived = await CatalogService.archiveProduct(auth.organizationId, productId, auth.userId);
  return successResponse(archived);
}, "canManageCatalog");

