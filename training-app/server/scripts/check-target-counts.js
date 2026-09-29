import { connectDatabase, closeDatabase, query } from '../src/db/pool.js';

const TABLES = [
  'training_ruang_acara', 'training_acara', 'training_peserta_acara', 'training_absensi',
  'training_test_set', 'training_test_session', 'training_question_pg', 'training_question_essay',
  'training_answer_pg', 'training_answer_essay', 'training_feedback', 'training_migration_map',
];

await connectDatabase();
const sqlText = `SELECT ${TABLES.map((t, i) => `(SELECT COUNT_BIG(*) FROM dbo.${t}) AS c${i}`).join(', ')};`;
const { recordset } = await query(sqlText);
const row = recordset[0];

let dirty = 0;
TABLES.forEach((table, index) => {
  const count = Number(row[`c${index}`]);
  if (count > 0) {
    console.log(`${table}: ${count}`);
    dirty += 1;
  }
});
console.log(dirty === 0 ? 'semua kosong' : `\n${dirty} tabel terisi`);
await closeDatabase();
