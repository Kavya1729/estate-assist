import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string({ error: 'Enter your email address' })
    .trim()
    .toLowerCase()
    .max(120)
    .email('Enter a valid email address'),
  password: z.string({ error: 'Enter your password' }).min(1, 'Enter your password').max(200),
});
