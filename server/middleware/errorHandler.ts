/**
 * Centralized Error Handling Middleware
 * 
 * This middleware provides:
 * - Consistent error response format
 * - User-friendly error messages (no internal details leaked)
 * - Detailed error logging for debugging
 * - Error classification and severity levels
 * - Request context preservation
 */

import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { MonitoringLogger } from "../services/monitoringLogger";

// ===========================================
// ERROR TYPES
// ===========================================

/**
 * Base application error class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: any;
  public readonly userMessage: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: any,
    userMessage?: string
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    this.userMessage = userMessage || this.getDefaultUserMessage(statusCode);
    
    Error.captureStackTrace(this, this.constructor);
  }

  private getDefaultUserMessage(statusCode: number): string {
    switch (statusCode) {
      case 400:
        return "Invalid request. Please check your input and try again.";
      case 401:
        return "Authentication required. Please log in.";
      case 403:
        return "You do not have permission to perform this action.";
      case 404:
        return "The requested resource was not found.";
      case 409:
        return "A conflict occurred. The resource may already exist.";
      case 422:
        return "The data provided is invalid.";
      case 429:
        return "Too many requests. Please wait a moment and try again.";
      case 500:
      default:
        return "An unexpected error occurred. Please try again later.";
    }
  }
}

/**
 * Validation error
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(
      message,
      400,
      'VALIDATION_ERROR',
      true,
      details,
      "Please check your input and correct the highlighted errors."
    );
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(
      message,
      401,
      'AUTHENTICATION_ERROR',
      true,
      undefined,
      "Your session has expired. Please log in again."
    );
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(
      message,
      403,
      'AUTHORIZATION_ERROR',
      true,
      undefined,
      "You do not have permission to access this resource."
    );
  }
}

/**
 * Not found error
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(
      `${resource} not found`,
      404,
      'NOT_FOUND',
      true,
      undefined,
      `The requested ${resource.toLowerCase()} could not be found.`
    );
  }
}

/**
 * Conflict error (e.g., duplicate record)
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(
      message,
      409,
      'CONFLICT',
      true,
      undefined,
      "This operation conflicts with existing data. The item may already exist."
    );
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends AppError {
  public readonly retryAfter?: number;

  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(
      message,
      429,
      'RATE_LIMIT_EXCEEDED',
      true,
      { retryAfter },
      "You've made too many requests. Please wait a moment before trying again."
    );
    this.retryAfter = retryAfter;
  }
}

/**
 * Database error
 */
export class DatabaseError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(
      message,
      500,
      'DATABASE_ERROR',
      true,
      { originalError: originalError?.message },
      "A database error occurred. Please try again later."
    );
  }
}

/**
 * External service error (API calls, etc.)
 */
export class ExternalServiceError extends AppError {
  public readonly serviceName: string;

  constructor(serviceName: string, message: string, statusCode?: number) {
    super(
      message,
      statusCode || 502,
      'EXTERNAL_SERVICE_ERROR',
      true,
      { serviceName },
      `The ${serviceName} service is temporarily unavailable. Please try again later.`
    );
    this.serviceName = serviceName;
  }
}

// ===========================================
// ERROR RESPONSE INTERFACE
// ===========================================

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    requestId?: string;
    timestamp: string;
  };
}

// ===========================================
// ERROR HANDLER MIDDLEWARE
// ===========================================

/**
 * Main error handler middleware
 * Should be registered last in the middleware chain
 */
export function errorHandler(
  err: Error | AppError | ZodError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req as any).requestId || 'unknown';
  const timestamp = new Date().toISOString();
  
  // Default error info
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let userMessage = 'An unexpected error occurred. Please try again later.';
  let details: any = undefined;
  let isOperational = false;
  
  // Handle different error types
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    userMessage = err.userMessage;
    details = err.details;
    isOperational = err.isOperational;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    userMessage = 'Please check your input and correct the highlighted errors.';
    details = err.issues.map(issue => ({
      field: issue.path.join('.') || 'root',
      message: issue.message,
    }));
    isOperational = true;
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    userMessage = 'Your session is invalid. Please log in again.';
    isOperational = true;
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    userMessage = 'Your session has expired. Please log in again.';
    isOperational = true;
  } else if ((err as any).code === '23505') { // PostgreSQL unique violation
    statusCode = 409;
    code = 'DUPLICATE_ENTRY';
    userMessage = 'This item already exists.';
    isOperational = true;
  } else if ((err as any).code === '23503') { // PostgreSQL foreign key violation
    statusCode = 400;
    code = 'REFERENTIAL_INTEGRITY';
    userMessage = 'This operation would violate data integrity constraints.';
    isOperational = true;
  }
  
  // Log the error
  const userId = (req as any).user?.id;
  const username = (req as any).user?.username;
  
  // Log to console
  if (!isOperational || statusCode >= 500) {
    console.error(`[ERROR] ${timestamp} - ${requestId}:`, {
      code,
      message: err.message,
      stack: err.stack,
      endpoint: req.path,
      method: req.method,
      userId,
    });
  } else {
    console.warn(`[WARN] ${timestamp} - ${requestId}: ${code} - ${err.message}`);
  }
  
  // Log to monitoring system (non-blocking)
  MonitoringLogger.logError({
    userId,
    username,
    errorType: code,
    errorMessage: err.message,
    errorStack: err.stack,
    endpoint: req.path,
    method: req.method,
    requestData: sanitizeRequestData(req),
    severity: statusCode >= 500 ? 'error' : 'warning',
  }).catch(logErr => {
    console.error('[ERROR-HANDLER] Failed to log to monitoring:', logErr);
  });
  
  // Build error response
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code,
      message: userMessage,
      requestId,
      timestamp,
    },
  };
  
  // Include validation details if available
  if (details && (code === 'VALIDATION_ERROR' || process.env.NODE_ENV === 'development')) {
    errorResponse.error.details = details;
  }
  
  // Send response
  res.status(statusCode).json(errorResponse);
}

/**
 * Sanitize request data for logging (remove sensitive info)
 */
function sanitizeRequestData(req: Request): any {
  const sanitized: any = {
    query: req.query,
    params: req.params,
  };
  
  if (req.body) {
    const body = { ...req.body };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'currentPassword', 'newPassword', 'confirmPassword', 'apiKey', 'token', 'secret'];
    for (const field of sensitiveFields) {
      if (field in body) {
        body[field] = '[REDACTED]';
      }
    }
    
    sanitized.body = body;
  }
  
  return sanitized;
}

// ===========================================
// ASYNC HANDLER WRAPPER
// ===========================================

/**
 * Wrap async route handlers to catch errors automatically
 * Usage: app.get('/route', asyncHandler(async (req, res) => { ... }))
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ===========================================
// REQUEST ID MIDDLEWARE
// ===========================================

/**
 * Add a unique request ID to each request for tracing
 */
export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  (req as any).requestId = generateRequestId();
  next();
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

// ===========================================
// NOT FOUND HANDLER
// ===========================================

/**
 * Handle 404 for undefined routes
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Route ${req.method} ${req.path}`));
}

// ===========================================
// ERROR LOGGING HELPERS
// ===========================================

/**
 * Log error without throwing (for background operations)
 */
export async function logError(
  error: Error,
  context?: { userId?: number; username?: string; operation?: string }
): Promise<void> {
  const timestamp = new Date().toISOString();
  
  console.error(`[ERROR] ${timestamp}:`, {
    message: error.message,
    stack: error.stack,
    ...context,
  });
  
  try {
    await MonitoringLogger.logError({
      userId: context?.userId,
      username: context?.username,
      errorType: error.name || 'Error',
      errorMessage: error.message,
      errorStack: error.stack,
      severity: 'error',
    });
  } catch (logErr) {
    console.error('[ERROR-LOGGER] Failed to log to monitoring:', logErr);
  }
}

/**
 * Create an error handler context for a specific operation
 */
export function createErrorContext(userId?: number, username?: string, operation?: string) {
  return {
    handleError: async (error: Error): Promise<void> => {
      await logError(error, { userId, username, operation });
    },
    wrapAsync: <T>(fn: () => Promise<T>): Promise<T> => {
      return fn().catch(async (error) => {
        await logError(error, { userId, username, operation });
        throw error;
      });
    },
  };
}