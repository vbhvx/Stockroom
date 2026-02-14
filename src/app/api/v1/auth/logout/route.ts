import { NextRequest } from "next/server";
import { successResponse } from "@/server/errors/response-helper";
import { COOKIE_NAME } from "@/server/auth/session";

export async function POST(req: NextRequest) {
  const response = successResponse({ message: "Logged out successfully" });
  response.cookies.delete(COOKIE_NAME);
  return response;
}

