import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { HttpError } from '../lib/httpError.js';
import { User } from '../models/index.js';

const JWT_ALGORITHM = 'HS256';

/** Compared against when the email is unknown so response time does not reveal which emails exist. */
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', 12);

const INVALID_CREDENTIALS = 'Email or password is incorrect.';

export function signToken(user) {
  return jwt.sign({ role: user.role }, env.JWT_SECRET, {
    subject: user.id,
    algorithm: JWT_ALGORITHM,
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

export function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
}

export async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');

  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !passwordOk) throw new HttpError(401, INVALID_CREDENTIALS);
  if (!user.isActive) throw new HttpError(403, 'This account has been deactivated.');

  return { token: signToken(user), user };
}
