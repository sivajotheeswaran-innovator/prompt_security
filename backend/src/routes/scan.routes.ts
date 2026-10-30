import { Router } from 'express';
import { scan, scanSchema } from '../controllers/scan.controller';
import { chat, chatSchema } from '../controllers/chat.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';

const router = Router();

router.post('/scan', requireAuth, validateBody(scanSchema), scan);
router.post('/chat', requireAuth, validateBody(chatSchema), chat);

export default router;
