import { db } from "@/db/client";
import { users, staffMemberships, organizations, stores } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../errors/app-error";
import { Role } from "../authorization/roles";
import { AuditService } from "./audit-service";
import { hashPassword } from "../auth/session";

export interface InviteStaffInput {
  email: string;
  name: string;
  role: Role;
  storeId?: string;
  temporaryPassword?: string;
}

export class StaffService {
  /**
   * List all staff members and their roles for an organization.
   */
  static async listStaff(organizationId: string) {
    const list = await db
      .select({
        membershipId: staffMemberships.id,
        userId: users.id,
        email: users.email,
        name: users.name,
        role: staffMemberships.role,
        status: staffMemberships.status,
        storeId: staffMemberships.storeId,
        storeName: stores.name,
        createdAt: staffMemberships.createdAt,
      })
      .from(staffMemberships)
      .innerJoin(users, eq(staffMemberships.userId, users.id))
      .leftJoin(stores, eq(staffMemberships.storeId, stores.id))
      .where(eq(staffMemberships.organizationId, organizationId));

    return list;
  }

  /**
   * Invite or create a new staff member.
   */
  static async inviteStaff(organizationId: string, input: InviteStaffInput, actorId: string) {
    const normalizedEmail = input.email.toLowerCase().trim();

    // Check if user already exists
    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!user) {
      const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const password = input.temporaryPassword || "TempPassword123!";
      const passwordHash = await hashPassword(password);

      [user] = await db
        .insert(users)
        .values({
          id: userId,
          email: normalizedEmail,
          name: input.name.trim(),
          passwordHash,
        })
        .returning();
    }

    // Check if already has membership in this organization
    const [existingMembership] = await db
      .select()
      .from(staffMemberships)
      .where(
        and(
          eq(staffMemberships.organizationId, organizationId),
          eq(staffMemberships.userId, user.id)
        )
      )
      .limit(1);

    if (existingMembership) {
      throw new ConflictError(`User ${normalizedEmail} is already a staff member of this organization`);
    }

    const membershipId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const [membership] = await db
      .insert(staffMemberships)
      .values({
        id: membershipId,
        organizationId,
        storeId: input.storeId || null,
        userId: user.id,
        role: input.role,
        status: "active",
      })
      .returning();

    await AuditService.record(db, {
      organizationId,
      actorId,
      action: "staff.invited",
      resourceType: "staff_membership",
      resourceId: membershipId,
      afterState: { membership, user: { id: user.id, email: user.email, name: user.name } },
      reason: `Invited ${user.name} (${user.email}) as ${input.role}`,
    });

    return {
      membership,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  /**
   * Update role of an existing staff member.
   * Protects against demoting the final owner of the organization.
   */
  static async updateStaffRole(
    organizationId: string,
    membershipId: string,
    newRole: Role,
    actorId: string
  ) {
    const [existing] = await db
      .select()
      .from(staffMemberships)
      .where(
        and(
          eq(staffMemberships.id, membershipId),
          eq(staffMemberships.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundError("StaffMembership", membershipId);
    }

    // If demoting an owner, verify there is at least one other active owner
    if (existing.role === "owner" && newRole !== "owner") {
      const activeOwners = await db
        .select()
        .from(staffMemberships)
        .where(
          and(
            eq(staffMemberships.organizationId, organizationId),
            eq(staffMemberships.role, "owner"),
            eq(staffMemberships.status, "active")
          )
        );

      if (activeOwners.length <= 1) {
        throw new ForbiddenError("Cannot demote the organization's sole remaining Owner");
      }
    }

    const [updated] = await db
      .update(staffMemberships)
      .set({
        role: newRole,
        updatedAt: new Date(),
      })
      .where(eq(staffMemberships.id, membershipId))
      .returning();

    await AuditService.record(db, {
      organizationId,
      actorId,
      action: "staff.role_updated",
      resourceType: "staff_membership",
      resourceId: membershipId,
      beforeState: existing,
      afterState: updated,
      reason: `Role changed from ${existing.role} to ${newRole}`,
    });

    return updated;
  }

  /**
   * Remove a staff member from the organization.
   * Protects against removing the final owner of the organization.
   */
  static async removeStaff(organizationId: string, membershipId: string, actorId: string) {
    const [existing] = await db
      .select()
      .from(staffMemberships)
      .where(
        and(
          eq(staffMemberships.id, membershipId),
          eq(staffMemberships.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundError("StaffMembership", membershipId);
    }

    if (existing.role === "owner") {
      const activeOwners = await db
        .select()
        .from(staffMemberships)
        .where(
          and(
            eq(staffMemberships.organizationId, organizationId),
            eq(staffMemberships.role, "owner"),
            eq(staffMemberships.status, "active")
          )
        );

      if (activeOwners.length <= 1) {
        throw new ForbiddenError("Cannot remove the organization's sole remaining Owner");
      }
    }

    await db.delete(staffMemberships).where(eq(staffMemberships.id, membershipId));

    await AuditService.record(db, {
      organizationId,
      actorId,
      action: "staff.removed",
      resourceType: "staff_membership",
      resourceId: membershipId,
      beforeState: existing,
      reason: `Staff member removed from organization`,
    });

    return { removed: true, membershipId };
  }
}

