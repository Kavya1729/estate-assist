import { ROLES } from '../../src/constants/domain.js';
import { User } from '../../src/models/index.js';

export const DEFAULT_PASSWORD = 'Demo@12345';

export async function createStaff({
  name = 'Ravi Mehta',
  email = 'ravi@estate.test',
  role = ROLES.SALES_EXECUTIVE,
  password = DEFAULT_PASSWORD,
  isActive = true,
} = {}) {
  const user = new User({ name, email, role, isActive });
  await user.setPassword(password);
  return user.save();
}
