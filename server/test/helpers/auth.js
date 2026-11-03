import { signToken } from '../../src/services/authService.js';

/** Authorization header for a staff member, without going through the rate-limited login. */
export function authHeader(user) {
  return { Authorization: `Bearer ${signToken(user)}` };
}
