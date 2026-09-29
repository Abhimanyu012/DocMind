import { Request, Response, NextFunction } from 'express';
import { HttpError } from '../lib/httpError';

// WHY: Ensures all errors returned by the API adhere to the standardized format:
// { "error": { "code": "...", "message": "..." } }
export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err instanceof HttpError ? err.statusCode : err.status || 500;
  const code = err instanceof HttpError ? err.code : 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected error occurred';

  if (statusCode >= 500) {
    console.error('🔥 Server Error:', err);
  }

  res.status(statusCode).json({
    error: {
      code,
      message,
    },
  });
}
