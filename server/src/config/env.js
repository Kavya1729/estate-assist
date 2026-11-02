import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    MONGODB_URI: z.string().url().default('mongodb://127.0.0.1:27017/estate-assist'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES_IN: z
      .string()
      .regex(/^\d+[smhd]$/, 'Use a duration like 12h or 7d')
      .default('12h'),
    CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
    LLM_PROVIDER: z.enum(['groq', 'mock']).default('mock'),
    GROQ_API_KEY: z.string().optional(),
    GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  })
  .superRefine((env, ctx) => {
    if (env.LLM_PROVIDER === 'groq' && !env.GROQ_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['GROQ_API_KEY'],
        message: 'GROQ_API_KEY is required when LLM_PROVIDER=groq',
      });
    }
  });

const nonEmpty = Object.fromEntries(
  Object.entries(process.env).filter(([, value]) => value !== ''),
);

const parsed = schema.safeParse(nonEmpty);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = Object.freeze(parsed.data);
