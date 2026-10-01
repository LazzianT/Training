import { connectDatabase, closeDatabase, query } from '../src/db/pool.js';

/*
  Lists every catalog row and says what references it, so a leaked row can be told
  apart from a real one before anything is removed.

  Read only. Deleting a catalog row is a decision for a person, not for a script:
  the rows are the record of what was taught.
*/
const run = async () => {
  await connectDatabase();
  const result = await query(`
    SELECT m.id, m.kode, m.nama, m.urutan, m.aktif,
           (SELECT COUNT_BIG(*) FROM dbo.training_ojt_jadwal_materi j WHERE j.materi_id = m.id) AS jadwal,
           (SELECT COUNT_BIG(*) FROM dbo.training_ojt_materi_peserta p WHERE p.materi_id = m.id) AS progres
    FROM dbo.training_ojt_materi m
    ORDER BY m.urutan, m.id;`);

  console.log(`rows: ${result.recordset.length}\n`);
  for (const row of result.recordset) {
    console.log(
      `  id=${String(row.id).padStart(3)}  ${String(row.kode).padEnd(5)} urutan=${String(row.urutan).padStart(3)}  ` +
        `${row.aktif ? 'aktif  ' : 'nonaktif'}  jadwal=${row.jadwal} progres=${row.progres}  ${row.nama}`,
    );
  }
  await closeDatabase();
};

run().catch(async (error) => {
  console.error('\nFAILED:', error.message);
  await closeDatabase().catch(() => undefined);
  process.exit(1);
});
