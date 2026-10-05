import { connectDatabase, closeDatabase, query } from '../src/db/pool.js';

/*
  Why would a code be refused? resolveQr accepts a row only when it is not revoked,
  not past expires_at, and not out of uses. This says which of those is true for
  every code that exists, so the answer is read off the data rather than guessed.
*/
const run = async () => {
  await connectDatabase();

  const rows = await query(`
    SELECT TOP 40 q.id, q.purpose, q.created_at_check, q.expires_at, q.revoked_at,
           q.used_count, q.max_uses, b.kode AS batch_kode, m.nama AS materi,
           DATEDIFF(day, SYSUTCDATETIME(), q.expires_at) AS hari_tersisa
    FROM (
      SELECT id, batch_id, materi_id, purpose, dibuat_pada AS created_at_check,
             expires_at, revoked_at, used_count, max_uses
      FROM dbo.training_ojt_qr_access
    ) q
    JOIN dbo.training_ojt_batch b ON b.id = q.batch_id
    JOIN dbo.training_ojt_materi m ON m.id = q.materi_id
    ORDER BY q.created_at_check DESC;`);

  console.log(`total OJT codes: ${rows.recordset.length}\n`);
  for (const r of rows.recordset) {
    const state =
      r.revoked_at ? 'REVOKED' : r.hari_tersisa < 0 ? 'EXPIRED' : 'live';
    console.log(
      `  ${state.padEnd(8)} ${String(r.purpose).padEnd(11)} ${String(r.materi).slice(0, 26).padEnd(27)} ` +
        `created ${new Date(r.created_at_check).toISOString().slice(0, 10)} ` +
        `expires ${new Date(r.expires_at).toISOString().slice(0, 10)} ` +
        `(${r.hari_tersisa}d) used ${r.used_count}/${r.max_uses}`,
    );
  }

  const summary = await query(`
    SELECT
      SUM(CASE WHEN revoked_at IS NOT NULL THEN 1 ELSE 0 END) AS revoked,
      SUM(CASE WHEN revoked_at IS NULL AND expires_at <= SYSUTCDATETIME() THEN 1 ELSE 0 END) AS expired,
      SUM(CASE WHEN revoked_at IS NULL AND expires_at > SYSUTCDATETIME() THEN 1 ELSE 0 END) AS live
    FROM dbo.training_ojt_qr_access;`);
  const s = summary.recordset[0];
  console.log(`\nlive ${s.live} · revoked ${s.revoked} · expired ${s.expired}`);

  const training = await query(`
    SELECT
      SUM(CASE WHEN revoked_at IS NOT NULL THEN 1 ELSE 0 END) AS revoked,
      SUM(CASE WHEN revoked_at IS NULL AND expires_at > SYSUTCDATETIME() THEN 1 ELSE 0 END) AS live
    FROM dbo.training_qr_access;`);
  console.log(`training codes: live ${training.recordset[0].live} · revoked ${training.recordset[0].revoked}`);

  await closeDatabase();
};

run().catch(async (error) => {
  console.error('FAILED:', error.message);
  await closeDatabase().catch(() => undefined);
  process.exit(1);
});
