import { NextRequest } from "next/server";
import { withAuth } from "@/server/auth/route-guard";
import { ReportingService } from "@/server/services/reporting-service";
import { successResponse } from "@/server/errors/response-helper";

export const GET = withAuth(async (req, { auth }) => {
  const summary = await ReportingService.getOperationalSummary(auth.organizationId);
  return successResponse(summary);
});

