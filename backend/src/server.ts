import { createApp } from './app';
import { env } from './config/env';
import { initDb, closePool } from './db/pool';

async function bootstrap() {
  try {
    // Initialize database tables and pgvector extension
    await initDb();

    const app = createApp();

    const server = app.listen(env.PORT, () => {
      console.log(`🚀 DocMind Backend running in ${env.NODE_ENV} mode on http://localhost:${env.PORT}`);
    });

    // Graceful shutdown handling
    // WHY: In production (e.g. Kubernetes, Docker, PM2), stopping a container should drain open connections cleanly.
    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        console.log('HTTP server closed.');
        try {
          await closePool();
          console.log('Database pool terminated.');
          process.exit(0);
        } catch (err) {
          console.error('Error during database pool shutdown:', err);
          process.exit(1);
        }
      });

      // Force exit after 10 seconds if shutdown hangs
      setTimeout(() => {
        console.error('Forced shutdown due to timeout.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('❌ Failed to start DocMind backend:', error);
    process.exit(1);
  }
}

bootstrap();
