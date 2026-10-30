import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import apiRoutes from './routes';
import { errorHandler } from './middleware/error.middleware';

export function createApp(): Express {
  const app = express();

  // Trust reverse proxy (Supabase, Render, Vercel) for accurate IP in rate limiting
  app.set('trust proxy', 1);

  // Security headers
  app.use(helmet());

  // CORS configuration strictly limited to configured frontend origin
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (internal/server-to-server) or matching FRONTEND_URL.
        // Allow localhost and 127.0.0.1 ONLY when NODE_ENV !== 'production' (Requirement 6)
        const isNotProduction = env.NODE_ENV !== 'production';
        const isLocalhost = Boolean(
          origin && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))
        );

        if (!origin || origin === env.FRONTEND_URL || (isNotProduction && isLocalhost)) {
          callback(null, true);
        } else {
          callback(new Error('Blocked by CORS policy'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Rate Limiting (standard security gateway protection)
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Limit each IP to 200 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'TooManyRequests',
      message: 'Too many requests from this IP, please try again after 15 minutes',
    },
  });
  app.use(limiter);

  // Body parser with 1mb limit
  app.use(express.json({ limit: '1mb' }));

  // Mount API router under /api
  app.use('/api', apiRoutes);

  // 404 handler for unknown routes
  app.use((req, res) => {
    res.status(404).json({
      error: 'NotFound',
      message: `Cannot ${req.method} ${req.originalUrl}`,
    });
  });

  // Centralized error handler
  app.use(errorHandler);

  return app;
}
