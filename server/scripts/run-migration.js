import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectDatabase, closeDatabase, query } from '../src/db/pool.js';

/*
  Applies every migrations/*.sql in filename order, and is safe to re-run.

  The SQL files are not tracked in git (.gitignore excludes *.sql), so a fresh
  clone has no way to bring its database up to date. This is the escape hatch
  until that ignore rule is revisited.

  Each file is expected to guard its own statements with IF NOT EXISTS /
  IF OBJECT_ID(...) IS NULL, which the existing migrations do. This runner does
  not try to detect what has already been applied: there is no ledger table, and
  a wrong answer from one is worse than an idempotent batch.
*/
const MIGRATIONS_DIR = join(process.cwd(), 'migrations');

const run = async () => {
  const files = (await readdir(MIGRATIONS_DIR)).filter((name) => name.endsWith('.sql')).sort();
  if (files.length === 0) {
    console.log('no .sql files found');
    return;
  }

  await connectDatabase();
  for (const file of files) {
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    process.stdout.write(`${file} ... `);
    await query(sql);
    console.log('ok');
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
