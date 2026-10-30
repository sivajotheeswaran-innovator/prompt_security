import { Router } from 'express';
import { register, login, registerSchema, loginSchema } from '../controllers/auth.controller';
import { validateBody } from '../middleware/validate.middleware';

const router = Router();

router.post('/register', validateBody(registerSchema), register);
router.post('/login', validateBody(loginSchema), login);

export default router;
