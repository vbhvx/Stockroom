import { NextRequest } from "next/server";
import { withAuth } from "@/server/auth/route-guard";
import { StaffService } from "@/server/services/staff-service";
import { successResponse } from "@/server/errors/response-helper";
import { ValidationError } from "@/server/errors/app-error";

export const POST = withAuth(async (req, { auth }) => {
  const body = await req.json();
  const { email, name, role, storeId, temporaryPassword } = body;

  if (!email || !name || !role) {
    throw new ValidationError("Email, name, and role are required");
  }

  const result = await StaffService.inviteStaff(
    auth.organizationId,
    { email, name, role, storeId, temporaryPassword },
    auth.userId
  );

  return successResponse(result, 201);
}, "canManageStaff");

