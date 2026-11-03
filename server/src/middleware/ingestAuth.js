import { createHash, timingSafeEqual } from 'node:crypto';

import { env } from '../config/env.js';
import { HttpError } from '../lib/httpError.js';
import { requireAuth } from './auth.js';

function sameSecret(a, b) {
  const digest = (value) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

/**
 * Lead sources (portal webhooks, ad forms) authenticate with the `X-Ingest-Key`
 * header; staff entering a lead by hand use their normal session instead.
 */
export function requireIngestAccess(req, res, next) {
  const key = req.get('x-ingest-key');
  if (key === undefined) return requireAuth(req, res, next);

  if (!env.INGEST_API_KEY || !sameSecret(key, env.INGEST_API_KEY)) {
    throw new HttpError(401, 'Invalid ingest key.');
  }
  req.ingestClient = true;
  next();
}
