import { connectDatabase, closeDatabase, query } from '../src/db/pool.js';
import { signAccessToken } from '../src/modules/auth/token.service.js';
import { createApp } from '../src/app.js';

/*
  The training chain, end to end, against an event dated tomorrow.

  Written for the report "cannot open it, I made an event for tomorrow". There was
  no date rule to blame: resolveQrAccess was selecting a column that had been dropped,
  so the query failed and every participant link for this chain returned an error
  regardless of the date.

  Everything it creates, it removes. The event is deleted directly, because the API
  deliberately has no delete for one.
*/
let server;
let baseUrl;
let eventId = null;

const call = async (path, token, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
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

let passed = 0;
let failed = 0;
const expect = (label, actual, expected) => {
  const ok = actual === expected;
  if (ok) passed += 1;
  else failed += 1;
  console.log(`  ${ok ? 'ok  ' : 'BAD '} ${label}: ${actual}${ok ? '' : ` (expected ${expected})`}`);
};

const cleanup = async () => {
  if (!eventId) return;
  await query('DELETE FROM dbo.training_qr_access WHERE event_id = @id;', (r) => r.input('id', eventId));
  await query('DELETE FROM dbo.training_peserta_acara WHERE event_id = @id;', (r) => r.input('id', eventId));
  await query('DELETE FROM dbo.training_acara_trainer WHERE event_id = @id;', (r) => r.input('id', eventId));
  await query('DELETE FROM dbo.training_acara WHERE id = @id;', (r) => r.input('id', eventId));
  eventId = null;
};

const run = async () => {
  server = await new Promise((resolve) => {
    const instance = createApp().listen(0, '127.0.0.1', () => resolve(instance));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  await connectDatabase();

  const hr = await query(
    "SELECT TOP 1 NIP FROM dbo.hris_Employee WHERE is_Active = '1' AND LTRIM(RTRIM(DepartID)) = '0300' ORDER BY NIP;",
  );
  const admin = signAccessToken({
    type: 'access',
    sub: hr.recordset[0].NIP,
    role: 'employee',
    departId: '0300',
    /*
      isCoordinator is what getEvent and canManage scope on, not departId, so a token
      without it sees no events at all and every call comes back 404 or 403.
    */
    isCoordinator: true,
    isEventTrainer: false,
  });

  // A failed earlier run can leave an event behind, since the API has no delete.
  const stale = await query("SELECT id FROM dbo.training_acara WHERE judul LIKE 'PROBE TRAINING %';");
  for (const row of stale.recordset) {
    eventId = row.id;
    await query('DELETE FROM dbo.training_qr_access WHERE event_id = @id;', (r) => r.input('id', row.id));
    await query('DELETE FROM dbo.training_peserta_acara WHERE event_id = @id;', (r) => r.input('id', row.id));
    await query('DELETE FROM dbo.training_acara_trainer WHERE event_id = @id;', (r) => r.input('id', row.id));
    await query('DELETE FROM dbo.training_acara WHERE id = @id;', (r) => r.input('id', row.id));
  }
  eventId = null;
  if (stale.recordset.length > 0) {
    console.log(`swept ${stale.recordset.length} leftover probe event(s)`);
  }

  const peserta = await query(
    "SELECT TOP 1 NIP FROM dbo.hris_Employee WHERE is_Active = '1' ORDER BY NIP DESC;",
  );
  const nip = peserta.recordset[0].NIP;

  // Tomorrow, which is the whole point of the report.
  const besok = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  console.log(`event dated ${besok} (tomorrow), participant ${nip}\n`);

  const created = await call('/api/events', admin, {
    method: 'POST',
    body: JSON.stringify({
      judul: `PROBE TRAINING ${Date.now()}`,
      tgl: besok,
      waktuMulai: '09:00',
      waktuSelesai: '12:00',
      sasaran: 'Probe',
      status: 'published',
      pengisiAcara: { type: 'external', name: 'Pengisi Probe' },
    }),
  });
  expect('event created', created.status, 201);
  console.log(`       created response: ${JSON.stringify(created.body)}`);
  eventId = created.body?.id ?? created.body?.eventId ?? null;
  if (!eventId) {
    console.log('  no event id in response:', JSON.stringify(created.body).slice(0, 200));
    await closeDatabase();
    server.close();
    process.exit(1);
  }

  const added = await call(`/api/events/${eventId}/peserta`, admin, {
    method: 'POST',
    body: JSON.stringify({ nips: [nip] }),
  });
  expect('participant added', added.status, 201);

  const qr = await call(`/api/assessment/events/${eventId}/qr`, admin, {
    method: 'POST',
    body: JSON.stringify({ purpose: 'attendance' }),
  });
  expect('QR created', qr.status, 201);
  expect('url is absolute', /^https?:\/\/[^/]+\/assessment\/access\/.+/.test(qr.body?.url ?? ''), true);
  expect('url has one scheme', (qr.body?.url ?? '').split('://').length - 1, 1);
  console.log(`       ${qr.body?.url}`);

  console.log('\nthe part that was broken');
  const access = await call(`/api/assessment/access/${qr.body.token}`, null);
  expect('participant link resolves', access.status, 200);
  expect('it names the event', access.body?.title?.startsWith('PROBE TRAINING'), true);
  expect('it carries the date', String(access.body?.date ?? '').startsWith(besok), true);
  expect('no isOjt flag is invented', 'isOjt' in (access.body ?? {}), false);

  /*
    The name picker needs the event's participants. It is the one list a QR holder
    can read without an account, so what it does *not* contain matters as much as
    what it does: scoped to this event, and carrying nothing but a name and a NIP.
  */
  const roster = access.body?.peserta;
  expect('roster is an array', Array.isArray(roster), true);
  expect('roster holds this participant', roster?.some((row) => row.nip === nip), true);
  expect('roster exposes only name and nip', [...new Set((roster ?? []).flatMap((row) => Object.keys(row)))].sort().join(','), 'name,nip');
  expect('roster is not the whole directory', (roster ?? []).length < 20, true);

  const others = await query(
    'SELECT COUNT(DISTINCT event_id) AS n FROM dbo.training_peserta_acara WHERE participant_nip = @nip;',
    (r) => r.input('nip', nip),
  );
  if (Number(others.recordset[0].n) === 1) {
    // Only meaningful when this person is on exactly one event: the roster should
    // then be that one event's list and nothing borrowed from elsewhere.
    expect('roster belongs to this event', (roster ?? []).length >= 1, true);
  }

  const opened = await call(`/api/assessment/access/${qr.body.token}/open`, null, {
    method: 'POST',
    body: JSON.stringify({ nip, signatureData: null }),
  });
  expect('participant identified', opened.status, 200);
  // The payload carries the event row, so the title arrives as judul, not title.
  expect('payload names the event', String(opened.body?.judul ?? '').startsWith('PROBE TRAINING'), true);

  console.log('\ncleanup');
  await cleanup();
  const left = await query(
    "SELECT COUNT(*) AS n FROM dbo.training_acara WHERE judul LIKE 'PROBE TRAINING %';",
  );
  console.log(`  probe events left: ${Number(left.recordset[0].n)}`);

  console.log(`\n${passed} passed, ${failed} failed`);
  await closeDatabase();
  server.close();
  if (failed > 0) process.exit(1);
};

run().catch(async (error) => {
  console.error('\nFAILED:', error.message);
  await cleanup().catch(() => undefined);
  server?.close();
  await closeDatabase().catch(() => undefined);
  process.exit(1);
});
