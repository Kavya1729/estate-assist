import { z } from 'zod';

import { isoDate } from './common.js';

export const dashboardQuerySchema = z
  .object({ from: isoDate().optional(), to: isoDate().optional() })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    path: ['to'],
    message: '"to" must be on or after "from"',
  });
