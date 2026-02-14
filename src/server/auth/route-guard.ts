import { NextRequest } from "next/server";
import { getAuthContextFromHeaders, SessionPayload } from "./session";
import { assertPermission, Permission } from "../authorization/roles";
import { errorResponse } from "../errors/response-helper";

export type AuthenticatedHandler = (
  req: NextRequest,
  context: { auth: SessionPayload; params: Record<string, string | string[]> }
) => Promise<Response>;

/**
 * Route wrapper that ensures authentication, extracts verified tenant context,
 * and checks optional granular permission before invoking the handler.
 */
export function withAuth(handler: AuthenticatedHandler, requiredPermission?: Permission) {
  return async (
    req: NextRequest,
    routeProps: { params?: Record<string, string | string[]> } = {}
  ) => {
    try {
      const auth = await getAuthContextFromHeaders(req.headers);

      if (requiredPermission) {
        assertPermission(auth.role, requiredPermission);
      }

      const params = routeProps.params || {};
      return await handler(req, { auth, params });
    } catch (error) {
      return errorResponse(error, req);
    }
  };
}

