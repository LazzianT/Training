import sql from 'mssql';
import { connectDatabase, closeDatabase, query } from '../src/db/pool.js';

await connectDatabase();

const attempts = [
  ['params first, OUTPUT last',
   'INSERT INTO dbo.training_ruang_acara (legacy_id, nama_ruangan, is_active) VALUES (@p0, @p1, @p2) OUTPUT INSERTED.id;'],
  ['OUTPUT before VALUES',
   'INSERT INTO dbo.training_ruang_acara (legacy_id, nama_ruangan, is_active) OUTPUT INSERTED.id VALUES (@p0, @p1, @p2);'],
];

for (const [label, text] of attempts) {
  try {
    const { recordset } = await query(text, (request) =>
      request.input('p0', sql.Int, 999).input('p1', sql.NVarChar(100), 'PROBE RUANG').input('p2', sql.Bit, 1));
    console.log(`OK   ${label} -> id=${recordset[0]?.id}`);
    await query('DELETE FROM dbo.training_ruang_acara WHERE legacy_id = 999;');
    console.log('     probe row dihapus');
  } catch (error) {
    console.log(`FAIL ${label} -> ${error.message}`);
  }
}

await closeDatabase();
