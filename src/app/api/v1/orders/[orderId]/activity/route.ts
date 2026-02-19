import { NextRequest } from "next/server";
import { withAuth } from "@/server/auth/route-guard";
import { AuditService } from "@/server/services/audit-service";
import { successResponse } from "@/server/errors/response-helper";

export const GET = withAuth(async (req, { auth, params }) => {
  const orderId = params.orderId as string;

  const activity = await AuditService.listEvents(auth.organizationId, {
    resourceId: orderId,
    limit: 100,
  });

  return successResponse(activity);
}, "canViewOrder");

