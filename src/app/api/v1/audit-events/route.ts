import { NextRequest } from "next/server";
import { withAuth } from "@/server/auth/route-guard";
import { AuditService } from "@/server/services/audit-service";
import { successResponse } from "@/server/errors/response-helper";

export const GET = withAuth(async (req, { auth }) => {
  const { searchParams } = new URL(req.url);
  const resourceType = searchParams.get("resourceType") || undefined;
  const resourceId = searchParams.get("resourceId") || undefined;
  const actorId = searchParams.get("actorId") || undefined;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;
  const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;

  const events = await AuditService.listEvents(auth.organizationId, {
    resourceType,
    resourceId,
    actorId,
    limit,
    offset,
  });

  return successResponse(events);
}, "canViewAuditHistory");

