import { createApp } from './app';
import { env } from './config/env';
import { runMigrations } from './db/migrate';
import { db } from './config/db';

async function bootstrap() {
  try {
    console.log('[Server] Starting TrustLayer Backend...');
    
    // Run database migrations
    await runMigrations();

    const app = createApp();

    const server = app.listen(env.PORT, () => {
      console.log(`[Server] TrustLayer API Gateway running on http://localhost:${env.PORT}`);
      console.log(`[Server] Health check available at http://localhost:${env.PORT}/api/health`);
    });

    const shutdown = async () => {
      console.log('[Server] Shutting down gracefully...');
      server.close(async () => {
        if (db.end) {
          await db.end();
        }
        console.log('[Server] Closed database connection and HTTP server.');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

bootstrap();
