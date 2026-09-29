import { Router } from 'express';
import { authController } from './auth.controller';
import { validate } from '../../middleware/validate';
import { registerSchema, loginSchema } from './auth.schemas';
import { authenticate } from '../../middleware/auth';

const router = Router();

// WHY: Declarative route definitions linking validation middleware, auth middleware, and controller methods.
router.post('/register', validate(registerSchema), (req, res, next) => authController.register(req, res, next));
router.post('/login', validate(loginSchema), (req, res, next) => authController.login(req, res, next));
router.get('/me', authenticate, (req, res, next) => authController.me(req, res, next));

export const authRoutes = router;
