import { NextRequest } from "next/server";
import { withAuth } from "@/server/auth/route-guard";
import { StaffService } from "@/server/services/staff-service";
import { successResponse } from "@/server/errors/response-helper";
import { ValidationError } from "@/server/errors/app-error";
import { Role } from "@/server/authorization/roles";

export const PATCH = withAuth(async (req, { auth, params }) => {
  const membershipId = params.membershipId as string;
  const body = await req.json();
  const { role } = body;

  if (!role) {
    throw new ValidationError("New role is required");
  }

  const updated = await StaffService.updateStaffRole(
    auth.organizationId,
    membershipId,
    role as Role,
    auth.userId
  );

  return successResponse(updated);
}, "canManageStaff");

export const DELETE = withAuth(async (req, { auth, params }) => {
  const membershipId = params.membershipId as string;
  const result = await StaffService.removeStaff(
    auth.organizationId,
    membershipId,
    auth.userId
  );

  return successResponse(result);
}, "canManageStaff");

