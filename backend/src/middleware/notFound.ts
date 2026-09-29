import { Request, Response, NextFunction } from 'express';
import { HttpError } from '../lib/httpError';

// WHY: Gracefully catches any unhandled HTTP routes and forwards a clean 404 NOT_FOUND error.
export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(new HttpError(404, `Route ${req.method} ${req.originalUrl} not found`, 'NOT_FOUND'));
}
