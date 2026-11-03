import { HttpError } from '../lib/httpError.js';
import { Lead } from '../models/index.js';
import { BUYER_TOKEN_TYPE, verifyToken } from '../services/authService.js';

const START_AGAIN = 'Your chat session has ended. Please start a new chat.';

/** Requires a buyer chat token and puts `{ leadId, since }` on `req.buyer`. */
export async function requireBuyer(req, _res, next) {
  const [scheme, token] = (req.get('authorization') ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new HttpError(401, START_AGAIN);

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new HttpError(401, START_AGAIN);
  }
  if (payload.typ !== BUYER_TOKEN_TYPE) throw new HttpError(401, START_AGAIN);
  if (!(await Lead.exists({ _id: payload.sub }))) throw new HttpError(401, START_AGAIN);

  req.buyer = { leadId: payload.sub, since: new Date(payload.since ?? payload.iat * 1000) };
  next();
}
