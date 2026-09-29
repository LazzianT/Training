/**
 * Read-only DB probe for the ORM/access-layer spike.
 * Runs SELECT-only statements. Never mutates data or schema.
 *
 * Usage: corepack pnpm --filter @training/server db:probe
 */
import sql from 'mssql';
import { config } from '../src/config.js';

const connectOptions = {
  server: config.DB_HOST,
  port: config.DB_PORT,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  database: config.DB_NAME,
  options: {
    encrypt: config.DB_ENCRYPT === 'true',
    trustServerCertificate: config.DB_TRUST_SERVER_CERTIFICATE === 'true',
  },
  requestTimeout: 15_000,
  connectionTimeout: 15_000,
};

const measure = async (label, run) => {
  const startedAt = performance.now();
  const result = await run();
  return { label, ms: Math.round(performance.now() - startedAt), result };
};

const main = async () => {
  const pool = await sql.connect(connectOptions);

  try {
    const identity = await measure('select @@VERSION / DB_NAME / SUSER_SNAME', async () => {
      const { recordset } = await pool
        .request()
        .query('SELECT @@VERSION AS version, DB_NAME() AS database_name, SUSER_SNAME() AS login_name;');
      return recordset[0];
    });

    const inventory = await measure('table inventory', async () => {
      const { recordset } = await pool.request().query(`
        SELECT
          SUM(CASE WHEN TABLE_NAME LIKE 'training[_]%' THEN 1 ELSE 0 END) AS training_tables,
          COUNT(*) AS total_tables
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE';
      `);
      return recordset[0];
    });

    const parameterized = await measure('parameterized hris_Employee count', async () => {
      const { recordset } = await pool
        .request()
        .input('active', sql.Bit, 1)
        .query('SELECT COUNT_BIG(*) AS active_employees FROM dbo.hris_Employee WHERE is_Active = @active;');
      return recordset[0];
    });

    const transaction = await measure('read-only transaction rollback', async () => {
      const inner = new sql.Transaction(pool);
      await inner.begin();
      const { recordset } = await inner.request().query('SELECT COUNT_BIG(*) AS total FROM dbo.hris_Employee;');
      await inner.rollback();
      return recordset[0];
    });

    console.log(
      JSON.stringify(
        {
          connectivity: 'ok',
          identity: identity.result,
          tableInventory: inventory.result,
          parameterizedQuery: parameterized.result,
          transactionRollback: transaction.result,
          timings: {
            identityMs: identity.ms,
            inventoryMs: inventory.ms,
            parameterizedMs: parameterized.ms,
            transactionMs: transaction.ms,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.close();
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
