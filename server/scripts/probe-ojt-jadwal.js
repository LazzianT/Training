import { connectDatabase, closeDatabase, query } from '../src/db/pool.js';
import { signAccessToken } from '../src/modules/auth/token.service.js';
import { createApp } from '../src/app.js';

/*
  Exercises the material schedule endpoints against the real database, then
  removes everything it created.

  The schedule path was already broken once and no test caught it: the unit tests
  only ever exercised the zod schemas, never the SQL behind them. This drives the
  routes with a minted token so a wrong Transaction API or a missing parameter
  binding fails here instead of in front of a user.
*/
let server;
let baseUrl;

const call = async (path, token, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  try {
    return { status: response.status, body: JSON.parse(text) };
  } catch {
    return { status: response.status, body: text };
  }
};

const run = async () => {
  server = await new Promise((resolve) => {
    const instance = createApp().listen(0, '127.0.0.1', () => resolve(instance));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  await connectDatabase();
  const hr = await query(
    "SELECT TOP 1 e.NIP FROM dbo.hris_Employee e WHERE e.is_Active = '1' AND LTRIM(RTRIM(e.DepartID)) = '0300' ORDER BY e.NIP;",
  );
  const token = signAccessToken({
    type: 'access',
    sub: hr.recordset[0]?.NIP ?? '0001',
    role: 'employee',
    departId: '0300',
  });

  // Sweep leftovers from earlier probe runs so a leaked row cannot be mistaken for
  // something this run failed to clean up.
  const stale = await query(
    "SELECT id FROM dbo.training_ojt_materi WHERE nama LIKE 'PROBE-%' OR nama LIKE 'PROBEJADWAL-%';",
  );
  for (const row of stale.recordset) {
    await query('DELETE FROM dbo.training_ojt_jadwal_materi WHERE materi_id = @id;', (r) =>
      r.input('id', row.id),
    );
    await query('DELETE FROM dbo.training_ojt_materi WHERE id = @id;', (r) => r.input('id', row.id));
  }
  console.log(`swept ${stale.recordset.length} leftover probe rows\n`);

  const batch = await call('/api/ojt/admin/batches', token);
  const batchId = batch.body[0]?.id;
  if (!batchId) {
    console.log('no batch available to probe against');
    await closeDatabase();
    server.close();
    return;
  }
  const detail = await call(`/api/ojt/admin/batches/${batchId}`, token);
  const dalam = detail.body.tanggalMulai;
  console.log(`batch #${batchId} window ${dalam} .. ${detail.body.tanggalSelesai}\n`);

  const nama = `PROBEJADWAL-${Date.now()}`;
  const pengisi = await query(
    "SELECT TOP 1 e.NIP FROM dbo.hris_Employee e WHERE e.is_Active = '1' AND LTRIM(RTRIM(e.DepartID)) <> '0300' ORDER BY e.NIP;",
  );
  const nip = pengisi.recordset[0]?.NIP ?? null;

  const create = await call(`/api/ojt/admin/batches/${batchId}/jadwal`, token, {
    method: 'POST',
    body: JSON.stringify({
      tanggal: dalam,
      namaMateri: nama,
      pengisiNip: nip,
      jamMulai: '09:00',
      jamSelesai: '12:00',
      catatan: 'probe',
    }),
  });
  console.log(`POST jadwal                 -> ${create.status} ${JSON.stringify(create.body)}`);

  if (create.status === 201) {
    const jadwalId = create.body.id;

    const reread = await call(`/api/ojt/admin/batches/${batchId}`, token);
    const entry = reread.body.jadwal.find((j) => j.id === jadwalId);
    console.log(`read back from batch        -> ${JSON.stringify(entry)}`);

    const patched = await call(`/api/ojt/admin/jadwal/${jadwalId}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ jamMulai: '13:00', jamSelesai: '16:00' }),
    });
    console.log(`\nPATCH jadwal               -> ${patched.status} ${JSON.stringify(patched.body)}`);

    const after = await call(`/api/ojt/admin/batches/${batchId}`, token);
    const changed = after.body.jadwal.find((j) => j.id === jadwalId);
    console.log(`read back after patch       -> ${JSON.stringify(changed)}`);

    const bad = await call(`/api/ojt/admin/jadwal/${jadwalId}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ jamMulai: '16:00', jamSelesai: '13:00' }),
    });
    console.log(`\nPATCH reversed times       -> ${bad.status} ${JSON.stringify(bad.body).slice(0, 120)}`);

    const outside = await call(`/api/ojt/admin/batches/${batchId}/jadwal`, token, {
      method: 'POST',
      body: JSON.stringify({ tanggal: '2019-01-01', namaMateri: `${nama}-luar` }),
    });
    console.log(`POST date outside window   -> ${outside.status} ${JSON.stringify(outside.body).slice(0, 140)}`);

    const unknownNip = await call(`/api/ojt/admin/batches/${batchId}/jadwal`, token, {
      method: 'POST',
      body: JSON.stringify({ tanggal: dalam, namaMateri: `${nama}-nip`, pengisiNip: 'ZZZZ' }),
    });
    console.log(`POST unknown presenter NIP -> ${unknownNip.status} ${JSON.stringify(unknownNip.body).slice(0, 140)}`);

    const removed = await call(`/api/ojt/admin/jadwal/${jadwalId}`, token, { method: 'DELETE' });
    console.log(`\nDELETE jadwal              -> ${removed.status}`);

    const gone = await call(`/api/ojt/admin/jadwal/${jadwalId}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ catatan: 'x' }),
    });
    console.log(`PATCH deleted jadwal       -> ${gone.status} ${JSON.stringify(gone.body).slice(0, 120)}`);
  }

  const leftovers = await query(
    "SELECT COUNT_BIG(*) AS n FROM dbo.training_ojt_materi WHERE nama LIKE 'PROBEJADWAL-%';",
  );
  console.log(`\nprobe materi rows left     : ${Number(leftovers.recordset[0].n)}`);
  await query("DELETE FROM dbo.training_ojt_materi WHERE nama LIKE 'PROBEJADWAL-%';");
  const jadwalLeft = await query(
    "SELECT COUNT_BIG(*) AS n FROM dbo.training_ojt_jadwal_materi j JOIN dbo.training_ojt_materi m ON m.id = j.materi_id WHERE m.nama LIKE 'PROBEJADWAL-%';",
  );
  console.log(`probe jadwal rows left     : ${Number(jadwalLeft.recordset[0].n)}`);

  await closeDatabase();
  server.close();
};

run().catch(async (error) => {
  console.error('\nFAILED:', error.message);
  server?.close();
  await closeDatabase().catch(() => undefined);
  process.exit(1);
});
