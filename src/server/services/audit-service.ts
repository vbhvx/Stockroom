import { db, Database } from "@/db/client";
import { auditEvents } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";

export interface CreateAuditParams {
  organizationId: string;
  storeId?: string | null;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  reason?: string | null;
  requestId?: string | null;
}

export class AuditService {
  /**
   * Records an immutable audit event in the database.
   * Can be passed an ongoing database transaction or defaults to main db.
   */
  static async record(
    client: Database | Parameters<Parameters<Database["transaction"]>[0]>[0],
    params: CreateAuditParams
  ) {
    const id = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const [event] = await (client as any)
      .insert(auditEvents)
      .values({
        id,
        organizationId: params.organizationId,
        storeId: params.storeId || null,
        actorId: params.actorId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        beforeState: params.beforeState || null,
        afterState: params.afterState || null,
        reason: params.reason || null,
        requestId: params.requestId || null,
      })
      .returning();

    return event;
  }

  static async listEvents(
    organizationId: string,
    filters?: {
      resourceType?: string;
      resourceId?: string;
      actorId?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const conditions = [eq(auditEvents.organizationId, organizationId)];

    if (filters?.resourceType) {
      conditions.push(eq(auditEvents.resourceType, filters.resourceType));
    }
    if (filters?.resourceId) {
      conditions.push(eq(auditEvents.resourceId, filters.resourceId));
    }
    if (filters?.actorId) {
      conditions.push(eq(auditEvents.actorId, filters.actorId));
    }

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    const events = await db
      .select()
      .from(auditEvents)
      .where(and(...conditions))
      .orderBy(desc(auditEvents.createdAt))
      .limit(limit)
      .offset(offset);

    return events;
  }
}

