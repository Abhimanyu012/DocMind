import { Router } from 'express';
import { chatController } from './chat.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { askChatSchema } from './chat.schemas';

const router = Router();

// All chat routes require authentication
router.use(authenticate);

router.post('/', validate(askChatSchema), (req, res, next) => chatController.ask(req, res, next));

export const chatRoutes = router;
