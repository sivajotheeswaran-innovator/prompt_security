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

// Mounted subrouters
router.use('/auth', authRoutes);
router.use('/policy', policyRoutes);
router.use('/', scanRoutes);
router.use('/', auditRoutes);

export default router;
