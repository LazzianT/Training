import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectDatabase, closeDatabase, query } from '../src/db/pool.js';

/*
  Applies every migrations/*.sql in filename order, and is safe to re-run.

  The SQL files are not tracked in git (.gitignore excludes *.sql), so a fresh
  clone has no way to bring its database up to date. This is the escape hatch
  until that ignore rule is revisited.

  Files are split on GO and each batch is sent separately. That is not cosmetic:
  SQL Server compiles a batch before running it, so an ALTER TABLE ... ADD that
  is followed by a statement reading the new column fails with "Invalid column
  name", and a CREATE TABLE with a foreign key onto a table created earlier in
  the same batch fails too. One statement per batch, the way SSMS behaves, and
  both shapes just work.

  Each file is expected to guard its own statements with IF NOT EXISTS /
  IF OBJECT_ID(...) IS NULL or a GO-guarded block, which the existing migrations
  do. This runner does not try to detect what has already been applied: there is
  no ledger table, and a wrong answer from one is worse than an idempotent batch.
*/
const MIGRATIONS_DIR = join(process.cwd(), 'migrations');

const GO_LINE = /^\s*GO\s*(?:--.*)?$/i;

/** SSMS treats GO as a separator, not a statement, so it never reaches the server. */
const splitBatches = (sql) =>
  sql
    .split(/\r?\n/)
    .reduce((batches, line) => {
      if (GO_LINE.test(line)) {
        batches.push({ lines: [], text: '' });
        return batches;
      }
      const batch = batches.at(-1);
      batch.lines.push(line);
      batch.text = `${batch.text}${line}\n`;
      return batches;
    }, [{ lines: [], text: '' }])
    .map((batch) => ({ text: batch.text.trim() }))
    .filter((batch) => batch.text !== '');

const run = async () => {
  const files = (await readdir(MIGRATIONS_DIR)).filter((name) => name.endsWith('.sql')).sort();
  if (files.length === 0) {
    console.log('no .sql files found');
    return;
  }

  await connectDatabase();
  for (const file of files) {
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    const batches = splitBatches(sql);
    process.stdout.write(`${file} (${batches.length} batch)`);
    for (const batch of batches) await query(batch.text);
    console.log(' ok');
  }
  await closeDatabase();
};

run().catch(async (error) => {
  console.error('\nFAILED:', error.message);
  try {
    await closeDatabase();
  } catch {
    /* already closed */
  }
  process.exit(1);
});