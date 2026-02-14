import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { users, staffMemberships, organizations, stores } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyPassword, createSessionToken, COOKIE_NAME } from "@/server/auth/session";
import { errorResponse, successResponse } from "@/server/errors/response-helper";
import { UnauthorizedError, ValidationError } from "@/server/errors/app-error";
import { Role } from "@/server/authorization/roles";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, organizationSlug } = body;

    if (!email || !password) {
      throw new ValidationError("Email and password are required");
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const passwordMatch = await verifyPassword(password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedError("Invalid email or password");
    }

    // Resolve membership
    let membershipQuery = db
      .select({
        membershipId: staffMemberships.id,
        role: staffMemberships.role,
        organizationId: staffMemberships.organizationId,
        storeId: staffMemberships.storeId,
        orgName: organizations.name,
        orgSlug: organizations.slug,
      })
      .from(staffMemberships)
      .innerJoin(organizations, eq(staffMemberships.organizationId, organizations.id))
      .where(
        and(
          eq(staffMemberships.userId, user.id),
          eq(staffMemberships.status, "active")
        )
      );

    if (organizationSlug) {
      membershipQuery = db
        .select({
          membershipId: staffMemberships.id,
          role: staffMemberships.role,
          organizationId: staffMemberships.organizationId,
          storeId: staffMemberships.storeId,
          orgName: organizations.name,
          orgSlug: organizations.slug,
        })
        .from(staffMemberships)
        .innerJoin(organizations, eq(staffMemberships.organizationId, organizations.id))
        .where(
          and(
            eq(staffMemberships.userId, user.id),
            eq(staffMemberships.status, "active"),
            eq(organizations.slug, organizationSlug)
          )
        );
    }

    const memberships = await membershipQuery;

    if (memberships.length === 0) {
      throw new UnauthorizedError("No active staff membership found for this user");
    }

    const activeMembership = memberships[0];

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      organizationId: activeMembership.organizationId,
      storeId: activeMembership.storeId || undefined,
      role: activeMembership.role as Role,
    };

    const token = await createSessionToken(tokenPayload);

    const response = successResponse({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: activeMembership.role,
        organizationId: activeMembership.organizationId,
        organizationName: activeMembership.orgName,
        storeId: activeMembership.storeId,
      },
    });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    return errorResponse(error, req);
  }
}

