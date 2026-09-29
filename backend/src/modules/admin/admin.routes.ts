import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { query } from '../../db/pool';

const router = Router();

// WHY: Demonstration of role-based access control (RBAC). Only authenticated users with role='admin' can access this.
router.get('/stats', authenticate, requireRole('admin'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const userCountResult = await query('SELECT COUNT(*) as count FROM users');
    const docCountResult = await query('SELECT COUNT(*) as count FROM documents');

    res.status(200).json({
      users: parseInt(userCountResult.rows[0].count, 10),
      documents: parseInt(docCountResult.rows[0].count, 10),
    });
  } catch (error) {
    next(error);
  }
});

export const adminRoutes = router;
