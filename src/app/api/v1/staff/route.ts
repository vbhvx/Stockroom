import { NextRequest } from "next/server";
import { withAuth } from "@/server/auth/route-guard";
import { StaffService } from "@/server/services/staff-service";
import { successResponse } from "@/server/errors/response-helper";

export const GET = withAuth(async (req, { auth }) => {
  const staff = await StaffService.listStaff(auth.organizationId);
  return successResponse(staff);
});

