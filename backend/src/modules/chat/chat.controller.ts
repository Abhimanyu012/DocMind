import { Request, Response, NextFunction } from 'express';
import { chatService } from './chat.service';

// WHY: Handles HTTP transport for RAG chat interactions, both JSON responses and SSE streaming.
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

  async askStream(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      // Set standard Server-Sent Events headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      await chatService.askStream(
        userId,
        req.body,
        (sources) => {
          res.write(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`);
        },
        (token) => {
          res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
        }
      );

      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    } catch (error: any) {
      if (res.headersSent) {
        res.write(
          `data: ${JSON.stringify({
            type: 'error',
            message: error.message || 'Error occurred during streaming',
          })}\n\n`
        );
        res.end();
      } else {
        next(error);
      }
    }
  }
}

export const chatController = new ChatController();
