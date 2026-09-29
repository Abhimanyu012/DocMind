import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import { env } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { notFound } from './middleware/notFound';
import { errorHandler } from './middleware/errorHandler';
import { authRoutes } from './modules/auth/auth.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { documentRoutes } from './modules/documents/documents.routes';
import { chatRoutes } from './modules/chat/chat.routes';

// Factory function to create and configure the Express application
// WHY: Decoupling app creation from server.listen allows clean, isolated integration testing with supertest.
export function createApp(): Application {
  const app = express();

  // Basic security and parsing middlewares
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use(requestLogger);

  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/chat', chatRoutes);

  // Fallback 404 handler for undefined routes
  app.use(notFound);

  // Central error handling middleware
  app.use(errorHandler);

  return app;
}
