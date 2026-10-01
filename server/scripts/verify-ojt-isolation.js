import { query, closeDatabase, connectDatabase } from '../src/db/pool.js';

/*
  End-to-end check that an OJT batch is invisible to the training side.
  Read only: it asserts, it never writes.
*/
const run = async () => {
  await connectDatabase();

  const batches = await query(
    'SELECT id, kode, judul, tanggal_mulai, tanggal_selesai, status, dibuat_oleh_nip FROM dbo.training_ojt_batch ORDER BY id;',
  );
  console.log(`ojt batches: ${batches.recordset.length}`);
  for (const row of batches.recordset) {
    console.log(`  #${row.id} ${row.kode} "${row.judul}" ${String(row.tanggal_mulai).slice(0, 10)}..${String(row.tanggal_selesai).slice(0, 10)} [${row.status}] by ${row.dibuat_oleh_nip}`);
  }

  const leaked = await query(`
    SELECT COUNT(*) AS n FROM dbo.training_acara a
    WHERE EXISTS (SELECT 1 FROM dbo.training_ojt_batch b
                  WHERE LTRIM(RTRIM(b.judul)) = LTRIM(RTRIM(a.judul))
                    AND b.tanggal_mulai = a.tgl);`);
  console.log(`\nOJT-shaped rows inside training_acara: ${Number(leaked.recordset[0].n)}`);

  const totals = await query(`
    SELECT (SELECT COUNT(*) FROM dbo.training_acara) AS acara,
           (SELECT COUNT(*) FROM dbo.training_peserta_acara) AS peserta,
           (SELECT COUNT(*) FROM dbo.training_certificate) AS sertifikat;`);
  const row = totals.recordset[0];
  console.log(`training totals: ${row.acara} acara, ${row.peserta} peserta, ${row.sertifikat} sertifikat`);

  const orphan = await query(`
    SELECT COUNT(*) AS n FROM dbo.training_ojt_peserta p
    LEFT JOIN dbo.training_ojt_batch b ON b.id = p.batch_id WHERE b.id IS NULL;`);
  console.log(`orphan ojt peserta (should be 0): ${Number(orphan.recordset[0].n)}`);

  await closeDatabase();
};

run().catch(async (error) => {
  console.error('FAILED:', error.message);
  await closeDatabase().catch(() => undefined);
  process.exit(1);
});
