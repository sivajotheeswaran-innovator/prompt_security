import { Router, Request, Response } from 'express';
import authRoutes from './auth.routes';
import policyRoutes from './policy.routes';
import scanRoutes from './scan.routes';
import auditRoutes from './audit.routes';

const router = Router();

// Health check endpoint (public)
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ ok: true });
});

// Diagnostic endpoint to debug Gemini connectivity directly
router.get('/test-gemini', async (req: Request, res: Response) => {
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const { env } = await import('../config/env');
    const key = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!key) {
      return res.status(500).json({ ok: false, error: 'GEMINI_API_KEY is not set' });
    }
    const modelName = env.GEMINI_CHAT_MODEL || env.GEMINI_MODEL || 'gemini-flash-lite-latest';
    const client = new GoogleGenerativeAI(key);
    const model = client.getGenerativeModel({ model: modelName });
    const result = await model.generateContent('ping');
    return res.status(200).json({
      ok: true,
      model: modelName,
      keyPrefix: key.slice(0, 12) + '...',
      reply: result.response.text(),
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: err.message || String(err),
      status: err.status,
      model: process.env.GEMINI_MODEL,
      keyPrefix: (process.env.GEMINI_API_KEY || '').slice(0, 12) + '...',
    });
  }
});

// Mounted subrouters
router.use('/auth', authRoutes);
router.use('/policy', policyRoutes);
router.use('/', scanRoutes);
router.use('/', auditRoutes);

export default router;
