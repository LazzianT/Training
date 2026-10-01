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

/**
 * Runs `fn` inside a transaction on a pooled connection and commits when it
 * resolves, rolling back on any throw.
 *
 * Needed when several statements must stand or fall together, such as adding a
 * row to a catalog and then referencing its generated id.
 *
 * `fn` receives a factory that hands out Requests bound to the transaction.
 *
 * It is deliberately a factory and not one Request, and not the Transaction:
 * mssql's Transaction only exposes begin, commit, rollback and request, so
 * passing it out gets "tx.query is not a function" on the first statement. A
 * single Request does not work either, because once it has run, re-declaring a
 * parameter name on it fails with EDUPEPARAM, which a two statement transaction
 * hits immediately. So: call request() once per statement, and every one of them
 * shares the transaction.
 *
 * The connection is released in finally rather than closed: it belongs to the
 * shared pool and closing it would tear down the app's connection for everyone.
 */
export const transaction = async (fn) => {
  const connection = await pool.connect();
  const tx = new sql.Transaction(connection);
  await tx.begin();
  try {
    const result = await fn(() => tx.request());
    await tx.commit();
    return result;
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
};
