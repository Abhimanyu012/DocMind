import { Request, Response, NextFunction } from 'express';
import { redis } from '../db/redis';
import { HttpError } from '../lib/httpError';

export interface RateLimitOptions {
  windowSeconds?: number;
  maxRequests?: number;
}

// WHY: Protects the API from DoS attacks, brute force, and rapid LLM token exhaustion.
export function rateLimiter(options: RateLimitOptions = {}) {
  const windowSeconds = options.windowSeconds || 60;
  const maxRequests = options.maxRequests || 30;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const identifier = req.user?.id || req.ip || 'anonymous';
      const key = `ratelimit:${identifier}`;

      const currentCount = await redis.incr(key);

      if (currentCount === 1) {
        await redis.expire(key, windowSeconds);
      }

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - currentCount));

      if (currentCount > maxRequests) {
        res.setHeader('Retry-After', windowSeconds);
        return next(
          new HttpError(
            429,
            `Too many requests. Limit is ${maxRequests} requests per ${windowSeconds}s. Please retry shortly.`,
            'RATE_LIMIT_EXCEEDED'
          )
        );
      }

      next();
    } catch (error) {
      // In case of rate limiter errors, allow request through to prevent service denial
      console.warn('Rate limiter error, permitting request:', error);
      next();
    }
  };
}
