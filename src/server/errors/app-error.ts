export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, statusCode = 500, code = "INTERNAL_SERVER_ERROR", details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden: Insufficient permissions") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(id ? `${resource} with ID '${id}' was not found` : `${resource} not found`, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

export class StateTransitionError extends AppError {
  constructor(entity: string, currentStatus: string, attemptedStatus: string) {
    super(
      `Cannot transition ${entity} from status '${currentStatus}' to '${attemptedStatus}'`,
      422,
      "INVALID_STATE_TRANSITION"
    );
  }
}

export class InsufficientInventoryError extends AppError {
  constructor(variantId: string, requested: number, available: number) {
    super(
      `Insufficient available inventory for variant '${variantId}'. Requested: ${requested}, Available: ${available}`,
      409,
      "INSUFFICIENT_INVENTORY",
      { variantId, requested, available }
    );
  }
}

