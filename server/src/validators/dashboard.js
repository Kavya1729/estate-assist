import { z } from 'zod';

import { DAY } from '../lib/time.js';
import { isoDate } from './common.js';

const MAX_RANGE_DAYS = 366;

export const dashboardQuerySchema = z
  .object({ from: isoDate().optional(), to: isoDate().optional() })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    path: ['to'],
    message: '"to" must be on or after "from"',
  })
  .refine(
    (q) => !q.from || !q.to || (Date.parse(q.to) - Date.parse(q.from)) / DAY < MAX_RANGE_DAYS,
    { path: ['from'], message: `The range can cover at most ${MAX_RANGE_DAYS} days` },
  );
