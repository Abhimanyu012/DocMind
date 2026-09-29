import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { HttpError } from '../lib/httpError';

export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
}

// Extend Express Request declaration to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// WHY: Verifies Bearer JWT tokens to securely identify the client making the request.
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new HttpError(401, 'Authentication token missing or invalid', 'UNAUTHORIZED'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthUser;
    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
    };
    next();
  } catch (error) {
    return next(new HttpError(401, 'Invalid or expired authentication token', 'UNAUTHORIZED'));
  }
}

// WHY: Enforces Role-Based Access Control (RBAC), ensuring normal users cannot access admin endpoints.
export function requireRole(role: 'admin' | 'user') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new HttpError(401, 'Authentication required', 'UNAUTHORIZED'));
    }

    if (req.user.role !== role) {
      return next(new HttpError(403, `Access denied: requires ${role} privileges`, 'FORBIDDEN'));
    }

    next();
  };
}
