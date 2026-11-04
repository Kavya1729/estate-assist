import express from 'express';
import helmet from 'helmet';

import { corsAllowlist } from './middleware/cors.js';
import authRouter from './routes/auth.js';
import chatRouter from './routes/chat.js';
import dashboardRouter from './routes/dashboard.js';
import healthRouter from './routes/health.js';
import leadsRouter from './routes/leads.js';
import projectsRouter from './routes/projects.js';
import reviewsRouter from './routes/reviews.js';
import slotsRouter from './routes/slots.js';
import staffRouter from './routes/staff.js';
import visitsRouter from './routes/visits.js';
import { notFound, errorHandler } from './middleware/errors.js';

export function createApp({ clientOrigins = [], trustProxy = false } = {}) {
  const app = express();

  app.disable('x-powered-by');
  // Behind Render's proxy the client IP comes from X-Forwarded-For; needed for rate limiting.
  if (trustProxy) app.set('trust proxy', 1);

  // The API only ever returns JSON, so nothing it serves may load resources or be framed.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      },
    }),
  );
  app.use(corsAllowlist(clientOrigins));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/leads', leadsRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/reviews', reviewsRouter);
  app.use('/api/slots', slotsRouter);
  app.use('/api/staff', staffRouter);
  app.use('/api/visits', visitsRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
