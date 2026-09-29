import { Router } from 'express';
import { chatController } from './chat.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { rateLimiter } from '../../middleware/rateLimit';
import { askChatSchema } from './chat.schemas';

const router = Router();

// All chat routes require authentication
router.use(authenticate);

// Protect chat endpoints with Redis-backed rate limiter (20 requests / 60 seconds)
router.use(rateLimiter({ windowSeconds: 60, maxRequests: 20 }));

// Standard grounded RAG query (with Redis answer caching)
router.post('/', validate(askChatSchema), (req, res, next) => chatController.ask(req, res, next));

// Real-time Server-Sent Events (SSE) streaming endpoint
router.post('/stream', validate(askChatSchema), (req, res, next) => chatController.askStream(req, res, next));

export const chatRoutes = router;
