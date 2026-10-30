import { Router } from 'express';
import { getPolicy, updatePolicy, updatePolicySchema } from '../controllers/policy.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';

const router = Router();

router.get('/', requireAuth, getPolicy);
router.put('/', requireAuth, validateBody(updatePolicySchema), updatePolicy);

export default router;
