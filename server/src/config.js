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
  // Comma separated allowlist, never a wildcard: a dev server may pick 5174.
  CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:5174,http://10.103.90.5:5173'),
  /*
    Origin a participant's phone can reach, used to build the QR links.

    Deliberately not the API's own host: the API is reached by the browser, but a
    QR is scanned by a phone on the office network, and those are not the same
    address. Left empty it falls back to the first CORS_ORIGIN entry, which is the
    app itself, so development works without setting anything.
  */
  PUBLIC_APP_URL: z.string().default(''),
  JWT_ACCESS_SECRET: z.string().min(32).default('development-only-change-this-secret-32chars'),
  JWT_ACCESS_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_PEPPER: z.string().min(32).default('development-only-refresh-pepper-32chars'),
  UPLOAD_ROOT: z.string().default('./data/uploads'),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  WHATSAPP_PROVIDER: z.string().default(''),
  WHATSAPP_API_KEY: z.string().default(''),
});

const parsed = environmentSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment: ${parsed.error.message}`);
}

export const config = parsed.data;

/** Trailing slashes removed so a configured value cannot produce "//ojt". */
const stripTrailingSlash = (value) => value.trim().replace(/\/+$/, '');

/**
 * Base URL for links that leave the server and get scanned or pasted.
 *
 * A QR code containing a relative path is not scannable into anything useful, so
 * these have to be absolute. PUBLIC_APP_URL wins when set; otherwise the first
 * CORS origin is used, because that entry is already required to be the app the
 * browser loads and is the closest thing to a known-reachable address.
 */
export const publicAppUrl = () => {
  const configured = stripTrailingSlash(config.PUBLIC_APP_URL);
  if (configured) return configured;
  const [first] = config.CORS_ORIGIN.split(',');
  return stripTrailingSlash(first ?? '');
};
