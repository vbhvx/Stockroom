import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "@/db/client";
import { users, staffMemberships, organizations, stores } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { UnauthorizedError, ForbiddenError } from "../errors/app-error";
import { Role } from "../authorization/roles";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "super-secure-dev-jwt-secret-key-for-stockroom-2026!!"
);

export const COOKIE_NAME = "stockroom_session";

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  organizationId: string;
  storeId?: string;
  role: Role;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getAuthContextFromHeaders(headers: Headers): Promise<SessionPayload> {
  // Check authorization header first
  const authHeader = headers.get("authorization");
  let token: string | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  }

  // If not in auth header, check cookies
  if (!token) {
    const cookieHeader = headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
      if (match) {
        token = match[1];
      }
    }
  }

  if (!token) {
    throw new UnauthorizedError("Authentication required: missing token or session");
  }

  const payload = await verifySessionToken(token);
  if (!payload) {
    throw new UnauthorizedError("Invalid or expired session token");
  }

  // Verify that the user and membership are still active in the database
  const [membership] = await db
    .select({
      id: staffMemberships.id,
      role: staffMemberships.role,
      status: staffMemberships.status,
    })
    .from(staffMemberships)
    .where(
      and(
        eq(staffMemberships.userId, payload.userId),
        eq(staffMemberships.organizationId, payload.organizationId),
        eq(staffMemberships.status, "active")
      )
    )
    .limit(1);

  if (!membership) {
    throw new ForbiddenError("Staff membership is no longer active or revoked");
  }

  // Ensure role matches current database role
  return {
    ...payload,
    role: membership.role as Role,
  };
}

