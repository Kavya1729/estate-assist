import { Router } from 'express';

import { isDatabaseConnected } from '../config/database.js';

const router = Router();

router.get('/', (_req, res) => {
  const database = isDatabaseConnected() ? 'up' : 'down';

  res.status(database === 'up' ? 200 : 503).json({
    status: database === 'up' ? 'ok' : 'degraded',
    database,
    uptime: Math.round(process.uptime()),
  });
});

export default router;
