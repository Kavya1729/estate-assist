import { Router } from 'express';

import { requireAuth } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { login } from '../services/authService.js';
import { loginSchema } from '../validators/auth.js';

const router = Router();

router.post('/login', loginLimiter, validate({ body: loginSchema }), async (req, res) => {
  const { token, user } = await login(req.valid.body);
  res.json({ token, user });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
