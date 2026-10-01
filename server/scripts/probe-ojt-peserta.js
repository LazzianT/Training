import { connectDatabase, closeDatabase, query } from '../src/db/pool.js';

/*
  Runs the exact statement ojt.repository.addPeserta issues, inside a transaction
  that is always rolled back. Proves the generated code path works against the
  real schema without leaving a row behind.
*/
const PROBE = `
BEGIN TRANSACTION;

DECLARE @exists int = (SELECT COUNT(*) FROM dbo.training_ojt_batch WHERE id = @batchId);
IF @exists = 0 THROW 51000, 'BATCH_NOT_FOUND', 1;

DECLARE @kode nvarchar(50) =
  'OJT-' + RIGHT('00000' + CAST(NEXT VALUE FOR dbo.training_ojt_peserta_kode_seq AS nvarchar(10)), 5);

INSERT INTO dbo.training_ojt_peserta (batch_id, kode_peserta, nama_lengkap)
OUTPUT INSERTED.id, INSERTED.kode_peserta, INSERTED.nama_lengkap
VALUES (@batchId, @kode, @namaLengkap);

ROLLBACK TRANSACTION;`;

const run = async () => {
  await connectDatabase();

  const batch = await query('SELECT TOP 1 id FROM dbo.training_ojt_batch ORDER BY id;');
  if (batch.recordset.length === 0) {
    console.log('no batch to probe against');
    await closeDatabase();
    return;
  }
  const batchId = Number(batch.recordset[0].id);
  const before = await query('SELECT COUNT_BIG(*) AS n FROM dbo.training_ojt_peserta;');

  const result = await query(PROBE, (request) =>
    request.input('batchId', batchId).input('namaLengkap', 'PROBE-DI-ROLLBACK'),
  );

  const after = await query('SELECT COUNT_BIG(*) AS n FROM dbo.training_ojt_peserta;');
  const probe = result.recordset[0];

  console.log(`batch under test   : #${batchId}`);
  console.log(`generated code     : ${probe.kode_peserta}`);
  console.log(`inserted id        : ${probe.id}`);
  console.log(`rows before / after: ${Number(before.recordset[0].n)} / ${Number(after.recordset[0].n)}`);
  console.log(
    Number(before.recordset[0].n) === Number(after.recordset[0].n)
      ? 'rolled back cleanly, nothing persisted'
      : 'WARNING: row count changed, the rollback did not hold',
  );

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
