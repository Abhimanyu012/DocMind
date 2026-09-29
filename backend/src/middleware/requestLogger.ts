import { Request, Response, NextFunction } from 'express';

// WHY: Visibility into every incoming HTTP request, its method, route, and time taken to complete.
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, originalUrl } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    console.log(`[HTTP] ${method} ${originalUrl} ${status} - ${duration}ms`);
  });

  next();
}
