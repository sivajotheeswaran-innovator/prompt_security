import { Router } from 'express';
import { getAudit, getStats } from '../controllers/audit.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/audit', requireAuth, getAudit);
router.get('/stats', requireAuth, getStats);

export default router;
