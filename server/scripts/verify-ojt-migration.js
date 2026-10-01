import { query, closeDatabase, connectDatabase } from '../src/db/pool.js';

const TABLES = [
  'training_ojt_batch',
  'training_ojt_peserta',
  'training_ojt_materi',
  'training_ojt_materi_peserta',
  'training_ojt_absensi',
  'training_ojt_test_set',
  'training_ojt_question_pg',
  'training_ojt_question_essay',
  'training_ojt_test_session',
  'training_ojt_answer_pg',
  'training_ojt_answer_essay',
  'training_ojt_answer_grade_pg',
  'training_ojt_answer_grade_essay',
  'training_ojt_feedback',
  'training_ojt_qr_access',
];

const run = async () => {
  await connectDatabase();
  console.log('connected\n');

  const objects = await query(`
    SELECT t.name AS table_name,
           (SELECT COUNT(*) FROM sys.foreign_keys fk WHERE fk.referenced_object_id = t.object_id) AS inbound_fks
    FROM sys.tables t WHERE t.name LIKE 'training_ojt[_]%' ORDER BY t.name;`);
  const present = new Set(objects.recordset.map((row) => row.table_name));

  const missing = TABLES.filter((name) => !present.has(name));
  console.log(`ojt tables present : ${present.size}/${TABLES.length}`);
  if (missing.length > 0) console.log(`MISSING            : ${missing.join(', ')}`);
  else console.log('all expected tables present');

  const leakage = await query(`
    SELECT COUNT(*) AS leaked FROM dbo.training_acara WHERE 1 = 0;`)
    .then(() => 'ok')
    .catch((error) => `error: ${error.message}`);
  console.log(`training_acara readable: ${leakage}`);

  const kind = await query(`
    SELECT COL_LENGTH('dbo.training_acara', 'kind') AS kind_column;`);
  console.log(`training_acara.kind column: ${kind.recordset[0].kind_column === null ? 'absent (correct)' : 'STILL PRESENT'}`);

  const materi = await query('SELECT kode, nama, urutan FROM dbo.training_ojt_materi ORDER BY urutan;');
  console.log(`\nmateri rows: ${materi.recordset.length}`);
  for (const row of materi.recordset) console.log(`  ${row.kode}  ${row.nama}`);

  const indexes = await query(`
    SELECT name FROM sys.indexes WHERE name LIKE 'IX[_]training[_]ojt[_]%' ORDER BY name;`);
  console.log(`\nindexes: ${indexes.recordset.length}`);
  for (const row of indexes.recordset) console.log(`  ${row.name}`);

  const counts = {};
  for (const name of TABLES) {
    const result = await query(`SELECT COUNT_BIG(*) AS n FROM dbo.${name};`);
    counts[name] = Number(result.recordset[0].n);
  }
  console.log('\nrow counts:');
  for (const name of TABLES) console.log(`  ${name.padEnd(34)} ${counts[name]}`);

  await closeDatabase();
};

run().catch(async (error) => {
  console.error('\nFAILED:', error.message);
  await closeDatabase().catch(() => undefined);
  process.exit(1);
});
