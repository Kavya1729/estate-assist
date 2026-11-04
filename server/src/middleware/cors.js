import cors from 'cors';

import { HttpError } from '../lib/httpError.js';

/**
 * Lets only the listed frontends call the API from a browser. Requests without
 * an Origin header (lead sources posting server-to-server, health checks, curl)
 * are not cross-origin browser calls, so they pass and rely on their own auth.
 */
export function corsAllowlist(origins = []) {
  const allowed = new Set(origins);
  return cors({
    origin(origin, done) {
      if (!origin || allowed.has(origin)) return done(null, true);
      done(new HttpError(403, 'This website is not allowed to use the API.'));
    },
    maxAge: 600,
  });
}
