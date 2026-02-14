import { NextRequest } from "next/server";
import { withAuth } from "@/server/auth/route-guard";
import { successResponse } from "@/server/errors/response-helper";
import { ROLE_PERMISSIONS } from "@/server/authorization/roles";
import { db } from "@/db/client";
import { organizations, stores } from "@/db/schema";
import { eq } from "drizzle-orm";

export const GET = withAuth(async (req, { auth }) => {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, auth.organizationId))
    .limit(1);

  const allStores = await db
    .select()
    .from(stores)
    .where(eq(stores.organizationId, auth.organizationId));

  const permissions = ROLE_PERMISSIONS[auth.role] || [];

  return successResponse({
    user: {
      id: auth.userId,
      email: auth.email,
      name: auth.name,
      role: auth.role,
      permissions,
      organization: {
        id: auth.organizationId,
        name: org?.name || "Organization",
        slug: org?.slug || "",
      },
      currentStoreId: auth.storeId || allStores[0]?.id || null,
      stores: allStores,
    },
  });
});

