import { NextRequest } from "next/server";
import { withAuth } from "@/server/auth/route-guard";
import { CatalogService } from "@/server/services/catalog-service";
import { successResponse } from "@/server/errors/response-helper";

export const GET = withAuth(async (req, { auth }) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const brand = searchParams.get("brand") || undefined;
  const search = searchParams.get("search") || undefined;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;
  const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;

  const products = await CatalogService.listProducts(auth.organizationId, {
    status,
    brand,
    search,
    limit,
    offset,
  });

  return successResponse(products);
});

export const POST = withAuth(async (req, { auth }) => {
  const body = await req.json();
  const product = await CatalogService.createProduct(auth.organizationId, body, auth.userId);
  return successResponse(product, 201);
}, "canManageCatalog");

