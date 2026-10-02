import { query, closeDatabase, connectDatabase } from '../src/db/pool.js';

const TABLES = [
  'training_ojt_batch',
  'training_ojt_peserta',
  'training_ojt_materi',
  'training_ojt_jadwal_materi',
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
    SELECT t.name AS table_name
    FROM sys.tables t WHERE t.name LIKE 'training_ojt[_]%' ORDER BY t.name;`);
  const present = new Set(objects.recordset.map((row) => row.table_name));

  const missing = TABLES.filter((name) => !present.has(name));
  console.log(`ojt tables present : ${present.size}/${TABLES.length}`);
  if (missing.length > 0) console.log(`MISSING            : ${missing.join(', ')}`);
  else console.log('all expected tables present');

  const kind = await query(`SELECT COL_LENGTH('dbo.training_acara', 'kind') AS kind_column;`);
  console.log(
    `training_acara.kind column: ${kind.recordset[0].kind_column === null ? 'absent (correct)' : 'STILL PRESENT'}`,
  );

  /*
    The assessment chain was rebuilt around materi_id. Checking the columns that
    matter is the only way to tell a migration that ran from one that was
    replayed into a shape that no longer matches the code.
  */
  const expected = [
    ['training_ojt_test_set', 'materi_id', true],
    ['training_ojt_test_set', 'batch_id', false],
    ['training_ojt_test_set', 'trainer_nip', false],
    ['training_ojt_qr_access', 'materi_id', true],
    ['training_ojt_feedback', 'materi_id', true],
    ['training_ojt_absensi', 'materi_id', true],
    ['training_ojt_absensi', 'peserta_id', true],
  ];
  console.log('\nassessment columns:');
  let wrong = 0;
  for (const [table, column, shouldExist] of expected) {
    const result = await query(`SELECT COL_LENGTH('dbo.${table}', '${column}') AS len;`);
    const exists = result.recordset[0].len !== null;
    const ok = exists === shouldExist;
    if (!ok) wrong += 1;
    console.log(
      `  ${ok ? 'ok  ' : 'BAD '} ${table}.${column} ${exists ? 'present' : 'absent'}` +
        ` (expected ${shouldExist ? 'present' : 'absent'})`,
    );
  }

  console.log('\nassessment indexes and constraints:');
  const keys = await query(`
    SELECT kc.name, kc.type_desc, OBJECT_NAME(kc.parent_object_id) AS table_name
    FROM sys.key_constraints kc
    WHERE OBJECT_NAME(kc.parent_object_id) LIKE 'training_ojt[_]%'
    ORDER BY table_name, kc.name;`);
  for (const row of keys.recordset) {
    console.log(`  ${row.table_name.padEnd(28)} ${row.type_desc.padEnd(12)} ${row.name}`);
  }

  const indexes = await query(`
    SELECT name, OBJECT_NAME(object_id) AS table_name FROM sys.indexes
    WHERE name LIKE 'IX[_]training[_]ojt[_]%' OR name LIKE 'UQ[_]training[_]ojt[_]%'
    ORDER BY table_name, name;`);
  for (const row of indexes.recordset) {
    console.log(`  ${row.table_name.padEnd(28)} index           ${row.name}`);
  }

  const materi = await query('SELECT kode, nama, urutan, aktif FROM dbo.training_ojt_materi ORDER BY urutan;');
  console.log(`\nmateri rows: ${materi.recordset.length}`);
  for (const row of materi.recordset) {
    console.log(`  ${row.kode.padEnd(5)} urutan=${String(row.urutan).padStart(3)} ${row.aktif ? 'aktif  ' : 'nonaktif'} ${row.nama}`);
  }

  console.log('\nrow counts:');
  for (const name of TABLES) {
    const result = await query(`SELECT COUNT_BIG(*) AS n FROM dbo.${name};`);
    console.log(`  ${name.padEnd(34)} ${result.recordset[0].n}`);
  }

  console.log(
    wrong === 0
      ? '\nOK: assessment chain is keyed on materi_id and the batch columns are gone.'
      : `\nFAILED: ${wrong} column expectations not met.`,
  );

  await closeDatabase();
};

run().catch(async (error) => {
  console.error('\nFAILED:', error.message);
  await closeDatabase().catch(() => undefined);
  process.exit(1);
});