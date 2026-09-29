import sql from 'mssql';
import { config } from '../config.js';

const pool = new sql.ConnectionPool({
  server: config.DB_HOST,
  port: config.DB_PORT,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  database: config.DB_NAME,
  options: {
    encrypt: config.DB_ENCRYPT === 'true',
    trustServerCertificate: config.DB_TRUST_SERVER_CERTIFICATE === 'true',
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
  requestTimeout: 15_000,
  connectionTimeout: 15_000,
});

let ready = null;

export const connectDatabase = () => {
  ready ??= pool.connect().then(
    () => true,
    (error) => {
      ready = null;
      throw error;
    },
  );
  return ready;
};

export const databaseReady = () => ready ?? Promise.resolve(false);

export const closeDatabase = () => pool.close();

/** Values are always bound, never interpolated, so this stays injection safe. */
export const query = (text, bind) => (bind ? bind(pool.request()) : pool.request()).query(text);
