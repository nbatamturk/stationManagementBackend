import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z
    .string()
    .min(1)
    .refine(
      (value) => {
        try {
          const parsed = new URL(value);
          return parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:';
        } catch {
          return false;
        }
      },
      {
        message:
          'DATABASE_URL must be a valid postgres URL. If password includes special chars like / @ : # ?, URL-encode it (e.g. "/" => "%2F").',
      },
    ),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('1d'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const fieldErrors = parsed.error.flatten().fieldErrors;
  console.error('Invalid environment variables:', fieldErrors);
  console.error('Tip: create a .env file from .env.example and set DATABASE_URL + JWT_SECRET.');
  throw new Error('Environment validation failed');
}

export const env = parsed.data;
