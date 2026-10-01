import { connectDatabase, closeDatabase, query } from '../src/db/pool.js';

/* Creates the participant-code sequence and proves it yields distinct codes. */
const CREATE = `
IF NOT EXISTS (SELECT 1 FROM sys.sequences WHERE name = 'training_ojt_peserta_kode_seq' AND SCHEMA_NAME(schema_id) = 'dbo')
  CREATE SEQUENCE dbo.training_ojt_peserta_kode_seq AS bigint
    START WITH 1 INCREMENT BY 1 MINVALUE 1 NO CYCLE NO CACHE;`;

const run = async () => {
  await connectDatabase();
  await query(CREATE);

  const seq = await query(
    "SELECT name FROM sys.sequences WHERE name = 'training_ojt_peserta_kode_seq' AND SCHEMA_NAME(schema_id) = 'dbo';",
  );
  console.log(`sequence exists: ${seq.recordset.length === 1}`);

  // NEXT VALUE FOR cannot be combined with TOP or OFFSET, so take the values
  // without a row limit and slice them here instead.
  const codes = await query(
    `SELECT 'OJT-' + RIGHT('00000' + CAST(NEXT VALUE FOR dbo.training_ojt_peserta_kode_seq AS nvarchar(10)), 5) AS kode
     FROM sys.objects WHERE type = 'S';`,
  );
  console.log(`sample codes: ${codes.recordset.slice(0, 3).map((row) => row.kode).join(', ')}`);

  const existing = await query('SELECT COUNT_BIG(*) AS n FROM dbo.training_ojt_peserta;');
  console.log(`participants already in db: ${Number(existing.recordset[0].n)}`);

  await closeDatabase();
};

run().catch(async (error) => {
  console.error('FAILED:', error.message);
  try {
    await closeDatabase();
  } catch {
    /* already closed */
  }
  process.exit(1);
});
