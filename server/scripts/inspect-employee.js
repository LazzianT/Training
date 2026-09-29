/** Temporary read-only inspection of hris_Employee columns (deleted after use). */
import sql from 'mssql';
import { config } from '../src/config.js';

const pool = await sql.connect({
  server: config.DB_HOST,
  port: config.DB_PORT,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  database: config.DB_NAME,
  options: { encrypt: config.DB_ENCRYPT === 'true', trustServerCertificate: true },
});

const cols = await pool.request().query(`
  SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'hris_Employee'
  ORDER BY ORDINAL_POSITION;
`);
console.log(JSON.stringify(cols.recordset, null, 1));

const sample = await pool.request().query(`
  SELECT TOP 5 CAST(BirthDate AS date) AS birth_date, DepartID, is_Active
  FROM dbo.hris_Employee WHERE is_Active = 1;
`);
console.log(JSON.stringify(sample.recordset, null, 1));

const dupCheck = await pool.request().query(`
  SELECT TOP 5 NIP, COUNT_BIG(*) AS c
  FROM dbo.hris_Employee
  GROUP BY NIP HAVING COUNT_BIG(*) > 1;
`);
console.log(JSON.stringify(dupCheck.recordset, null, 1));

await pool.close();
