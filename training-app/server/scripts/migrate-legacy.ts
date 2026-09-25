import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sql from 'mssql';
import { config } from '../src/config.js';

const mode = process.env.MIGRATION_MODE ?? 'dry-run';
const sourcePath = resolve(process.cwd(), process.env.SOURCE_SQL_PATH ?? '../../training.sql');
const ddlPath = resolve(process.cwd(), 'migrations/001_training_schema.sql');

const countRows = (valuesBlock: string) =>
  valuesBlock.split(/\r?\n/).filter((line) => /^\s*\(/.test(line)).length;

const inspectSource = (source: string) => {
  const tables = [...source.matchAll(/CREATE TABLE `([^`]+)`/g)].map((match) => match[1]);
  const insertBatches = [...source.matchAll(/INSERT INTO `([^`]+)`[\s\S]*?VALUES\n([\s\S]*?);/g)].map((match) => ({
    table: match[1],
    rows: countRows(match[2]),
  }));
  const inserts = Object.entries(
    insertBatches.reduce<Record<string, number>>((totals, batch) => {
      totals[batch.table] = (totals[batch.table] ?? 0) + batch.rows;
      return totals;
    }, {}),
  ).map(([table, rows]) => ({ table, rows }));
  const alterStatements = [...source.matchAll(/ALTER TABLE `([^`]+)`/g)].map((match) => match[1]);
  const sensitiveColumns = ['PASSWORD', 'NIP', 'NONIK', 'JAWABAN', 'FEEDBACK', 'PHOTO', 'FILE_TTD'];

  return {
    tables,
    inserts,
    insert_batch_count: insertBatches.length,
    alterStatements,
    sourceBytes: Buffer.byteLength(source, 'utf8'),
    sensitiveColumns: sensitiveColumns.filter((column) => source.toUpperCase().includes(column)),
  };
};

const assertApplyApproval = () => {
  const required = ['DBA_APPROVAL_ID', 'DBA_APPROVED_BY'];
  if (process.env.DBA_APPROVED !== 'true' || required.some((name) => !process.env[name])) {
    throw new Error('Apply blocked. Require MIGRATION_MODE=apply, DBA_APPROVED=true, DBA_APPROVAL_ID, and DBA_APPROVED_BY.');
  }
};

const main = async () => {
  if (!['dry-run', 'apply'].includes(mode)) throw new Error(`Unsupported MIGRATION_MODE: ${mode}`);
  if (mode === 'apply') assertApplyApproval();

  const source = await readFile(sourcePath, 'utf8');
  const ddl = await readFile(ddlPath, 'utf8');
  const inventory = inspectSource(source);
  const pool = await sql.connect({
    server: config.DB_HOST,
    port: config.DB_PORT,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_NAME,
    options: {
      encrypt: config.DB_ENCRYPT === 'true',
      trustServerCertificate: config.DB_TRUST_SERVER_CERTIFICATE === 'true',
    },
  });

  try {
    const metadata = await pool.request().query(`
      SELECT @@SERVERNAME AS server_name, DB_NAME() AS database_name, SUSER_SNAME() AS login_name;
      SELECT TABLE_SCHEMA AS schema_name, TABLE_NAME AS table_name
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME LIKE 'training[_]%'
      ORDER BY TABLE_SCHEMA, TABLE_NAME;
    `);
    const existingTrainingTables = metadata.recordsets[1] as Array<{ schema_name: string; table_name: string }>;

    if (mode === 'dry-run') {
      console.log(JSON.stringify({ mode, sourcePath, ddlPath, inventory, existingTrainingTables }, null, 2));
      return;
    }

    if (existingTrainingTables.length > 0) {
      throw new Error('Apply blocked: existing training_* tables detected. Use a reviewed migration version.');
    }

    await pool.request().batch(ddl);
    console.log(JSON.stringify({ mode, applied: true, tablesCreated: inventory.tables.length }, null, 2));
  } finally {
    await pool.close();
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
