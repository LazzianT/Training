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
    Override for the address that leaves the server and gets scanned.

    Leave it empty and the address is taken from the request instead, which is the
    address the person issuing the code is actually using and therefore the one
    that works. Set it only when participants reach the app at a different address
    than the admin does, which is the case PUBLIC_APP_URL exists for: an internal
    hostname on one side, a public one on the other.
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
 * The origin the browser used, read off the request.
 *
 * Split out from publicAppUrl so it can be tested without depending on whatever
 * PUBLIC_APP_URL happens to hold in the environment the tests run in.
 *
 * X-Forwarded-Proto is honoured because a proxy may terminate TLS, in which case
 * the hop to us is plain http and req.protocol alone would report the wrong
 * scheme.
 */
export const originFromRequest = (request) => {
  const forwardedProto = request?.get?.('x-forwarded-proto')?.split(',')[0]?.trim();
  const proto = forwardedProto || request?.protocol || 'http';
  const host = request?.get?.('host');
  return host ? `${proto}://${host}` : null;
};

/**
 * Base URL for links that leave the server and get scanned or pasted.
 *
 * A QR code containing a relative path is not scannable into anything useful, so
 * these have to be absolute.
 *
 * The order matters. PUBLIC_APP_URL first, for the case where participants reach
 * the app at a different address than the admin does. Otherwise the address is
 * taken from the request that is issuing the code, because that address is
 * demonstrably reachable: it is the one the browser just used.
 *
 * Deriving it from the request rather than from CORS_ORIGIN is what makes the
 * container work with no configuration at all. Behind the nginx in front of this
 * API, Host is the host the browser typed, so a deployment on some office address
 * hands out codes for that address instead of for localhost, which is what a
 * configured default silently did.
 *
 * Called with no request it still answers, so a probe or a test can ask what the
 * fallback would be.
 */
export const publicAppUrl = (request) => {
  const configured = stripTrailingSlash(config.PUBLIC_APP_URL);
  if (configured) return configured;

  const fromRequest = originFromRequest(request);
  if (fromRequest) return fromRequest;

  const [first] = config.CORS_ORIGIN.split(',');
  return stripTrailingSlash(first ?? '');
};
