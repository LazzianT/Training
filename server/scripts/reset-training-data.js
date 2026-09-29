/**
 * Empties the training_* tables so migrate:data can run again.
 *
 * Only touches training_* tables. Never touches hris_Employee or any other
 * existing table. Deletes children before parents to satisfy the foreign keys.
 *
 * Requires RESET_TRAINING_DATA=true so it cannot be run by accident.
 *
 * Usage: $env:RESET_TRAINING_DATA='true'; corepack pnpm --filter @training/server migrate:reset
 */
import { connectDatabase, closeDatabase, query } from '../src/db/pool.js';

if (process.env.RESET_TRAINING_DATA !== 'true') {
  console.error('Dibatalkan. Set RESET_TRAINING_DATA=true untuk mengonfirmasi.');
  process.exit(1);
}

/** Children first, then parents. */
const TABLES = [
  'training_answer_grade_pg',
  'training_answer_grade_essay',
  'training_answer_pg',
  'training_answer_essay',
  'training_test_session',
  'training_question_pg',
  'training_question_essay',
  'training_test_set',
  'training_certificate',
  'training_notification_outbox',
  'training_qr_access',
  'training_feedback',
  'training_legacy_history',
  'training_absensi',
  'training_peserta_acara',
  'training_acara_trainer',
  'training_acara',
  'training_ruang_acara',
  'training_user_credential',
  'training_refresh_session',
  'training_migration_map',
  'training_audit_log',
];

await connectDatabase();

let total = 0;
for (const table of TABLES) {
  const { rowsAffected } = await query(`DELETE FROM dbo.${table};`);
  const removed = rowsAffected?.[0] ?? 0;
  if (removed > 0) console.log(`${table}: ${removed} baris dihapus`);
  total += removed;
}

console.log(`\nTotal ${total} baris dihapus dari ${TABLES.length} tabel training_*.`);
await closeDatabase();
