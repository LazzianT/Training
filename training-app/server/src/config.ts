import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

const envPath =
  process.env.DOTENV_CONFIG_PATH ??
  [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../.env'), resolve(process.cwd(), '../../.env')].find(existsSync) ??
  resolve(process.cwd(), '.env');

dotenv.config({ path: envPath });

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().default(1433),
  DB_USER: z.string().default('training_app'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().default('BMC'),
  DB_ENCRYPT: z.enum(['true', 'false']).default('false'),
  DB_TRUST_SERVER_CERTIFICATE: z.enum(['true', 'false']).default('true'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_ACCESS_SECRET: z.string().min(32).default('development-only-change-this-secret-32chars'),
  REFRESH_TOKEN_PEPPER: z.string().min(32).default('development-only-refresh-pepper-32chars'),
  UPLOAD_ROOT: z.string().default('./data/uploads'),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  WHATSAPP_PROVIDER: z.string().default(''),
  WHATSAPP_API_KEY: z.string().default(''),
});

export const config = environmentSchema.parse(process.env);
