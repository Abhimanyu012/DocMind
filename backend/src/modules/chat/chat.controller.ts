import { Request, Response, NextFunction } from 'express';
import { chatService } from './chat.service';

// WHY: Handles HTTP transport for RAG chat interactions.
export class ChatController {
  async ask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const result = await chatService.ask(userId, req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const chatController = new ChatController();
