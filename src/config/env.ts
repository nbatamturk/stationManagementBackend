import 'dotenv/config';
import { z } from 'zod';

const booleanishSchema = z.enum(['true', 'false', '1', '0']);
const postgresUrlSchema = z
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
  );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  TRUST_PROXY: booleanishSchema.default('false').transform((value) => value === 'true' || value === '1'),
  JSON_BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(1024 * 1024),
  DATABASE_URL: postgresUrlSchema,
  TEST_DATABASE_URL: postgresUrlSchema.optional(),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('1d'),
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1_000).default(15 * 60 * 1_000),
  LOGIN_RATE_LIMIT_BLOCK_MS: z.coerce.number().int().min(1_000).default(15 * 60 * 1_000),
  UPLOADS_DIR: z.string().min(1).default('uploads'),
  ATTACHMENTS_MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  MODEL_IMAGES_MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const fieldErrors = parsed.error.flatten().fieldErrors;
  console.error('Invalid environment variables:', fieldErrors);
  console.error('Tip: create a .env file from .env.example and set DATABASE_URL + JWT_SECRET.');
  throw new Error('Environment validation failed');
}

export const env = {
  ...parsed.data,
  DATABASE_URL:
    parsed.data.NODE_ENV === 'test' && parsed.data.TEST_DATABASE_URL
      ? parsed.data.TEST_DATABASE_URL
      : parsed.data.DATABASE_URL,
};
