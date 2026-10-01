import { connectDatabase, closeDatabase, query } from '../src/db/pool.js';

/*
  Deactivates the seed placeholder materials: rows whose kode is exactly "M" plus
  their own urutan, and whose nama is "Materi" plus that same number. That exact
  match is the only thing that qualifies a row, so a real material can never be
  caught by this even if someone names a real one similarly.

  Deactivation, not deletion: these rows are referenced by foreign keys and a
  delete would either fail or take real history with it.

  Any row that does not match the pattern, or that already has schedules or
  completions, is reported and left alone.
*/
const run = async () => {
  await connectDatabase();

  const candidates = await query(`
    SELECT m.id, m.kode, m.nama, m.aktif,
           (SELECT COUNT_BIG(*) FROM dbo.training_ojt_jadwal_materi j WHERE j.materi_id = m.id) AS jadwal_count,
           (SELECT COUNT_BIG(*) FROM dbo.training_ojt_materi_peserta p WHERE p.materi_id = m.id) AS progres_count
    FROM dbo.training_ojt_materi m
    WHERE m.kode = 'M' + CAST(m.urutan AS nvarchar(10))
      AND m.nama = 'Materi ' + CAST(m.urutan AS nvarchar(10))
    ORDER BY m.urutan;`);

  console.log(`placeholder rows matched: ${candidates.recordset.length}\n`);

  let deactivated = 0;
  for (const row of candidates.recordset) {
    if (row.jadwal_count > 0 || row.progres_count > 0) {
      console.log(
        `  SKIP    ${row.kode} ${row.nama}: referenced by ${row.jadwal_count} jadwal / ${row.progres_count} progres`,
      );
      continue;
    }
    if (!row.aktif) {
      console.log(`  ALREADY ${row.kode} ${row.nama}: inactive`);
      continue;
    }
    await query('UPDATE dbo.training_ojt_materi SET aktif = 0 WHERE id = @id;', (request) =>
      request.input('id', row.id),
    );
    deactivated += 1;
    console.log(`  OFF     ${row.kode} ${row.nama}`);
  }

  console.log(`\ndeactivated: ${deactivated}`);

  const left = await query('SELECT COUNT_BIG(*) AS n FROM dbo.training_ojt_materi WHERE aktif = 1;');
  console.log(`active materials remaining: ${Number(left.recordset[0].n)}`);

  await closeDatabase();
};

run().catch(async (error) => {
  console.error('\nFAILED:', error.message);
  await closeDatabase().catch(() => undefined);
  process.exit(1);
});
