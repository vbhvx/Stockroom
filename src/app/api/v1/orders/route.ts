import { NextRequest } from "next/server";
import { withAuth } from "@/server/auth/route-guard";
import { OrderService, OrderStatus } from "@/server/services/order-service";
import { successResponse } from "@/server/errors/response-helper";

export const GET = withAuth(async (req, { auth }) => {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get("storeId") || undefined;
  const status = (searchParams.get("status") as OrderStatus) || undefined;
  const search = searchParams.get("search") || undefined;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;
  const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;

  const orders = await OrderService.listOrders(auth.organizationId, {
    storeId,
    status,
    search,
    limit,
    offset,
  });

  return successResponse(orders);
}, "canViewOrder");

export const POST = withAuth(async (req, { auth }) => {
  const body = await req.json();
  const idempotencyKey = req.headers.get("x-idempotency-key") || body.idempotencyKey;

  const order = await OrderService.createOrder(
    auth.organizationId,
    {
      ...body,
      idempotencyKey,
    },
    auth.userId
  );

  return successResponse(order, 201);
});

