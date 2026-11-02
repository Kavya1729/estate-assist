import { User } from '../models/index.js';
import { verifyToken } from '../services/authService.js';
import { HttpError } from './errors.js';

/**
 * Requires a valid `Authorization: Bearer <token>` header and loads the staff
 * member on `req.user`. The user is re-read on every request so deactivating
 * an account or changing a role takes effect immediately.
 */
export async function requireAuth(req, _res, next) {
  const [scheme, token] = (req.get('authorization') ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'Please sign in to continue.');

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    throw new HttpError(
      401,
      err.name === 'TokenExpiredError'
        ? 'Your session has expired. Please sign in again.'
        : 'Please sign in to continue.',
    );
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw new HttpError(401, 'Please sign in to continue.');

  req.user = user;
  next();
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) throw new HttpError(401, 'Please sign in to continue.');
    if (!roles.includes(req.user.role)) {
      throw new HttpError(403, 'You do not have access to this action.');
    }
    next();
  };
}
