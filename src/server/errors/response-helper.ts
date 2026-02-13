import { NextResponse } from "next/server";
import { AppError } from "./app-error";
import { ZodError } from "zod";

export function successResponse<T>(data: T, status = 200, headers?: HeadersInit) {
  return NextResponse.json({ data }, { status, headers });
}

export function errorResponse(error: unknown, req?: Request) {
  const requestId = req?.headers.get("x-request-id") || `req_${Math.random().toString(36).substring(2, 10)}`;

  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId,
        },
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: { issues: error.issues },
          requestId,
        },
      },
      { status: 400 }
    );
  }

  console.error(`[Unhandled Error] RequestID: ${requestId}`, error);

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An internal server error occurred",
        requestId,
      },
    },
    { status: 500 }
  );
}

