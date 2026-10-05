import { connectDatabase, closeDatabase, query } from '../src/db/pool.js';
import { signAccessToken } from '../src/modules/auth/token.service.js';
import { createApp } from '../src/app.js';

/*
  Drives the certificate endpoints against the real database, then removes what it
  created. The SQL here is new and every previous round of new SQL in this project
  has had at least one fault that only a live call could find.
*/
let server;
let baseUrl;
let createdId = null;

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

const run = async () => {
  server = await new Promise((resolve) => {
    const instance = createApp().listen(0, '127.0.0.1', () => resolve(instance));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  await connectDatabase();

  // Someone with attendance recorded, and someone without, so both paths are covered.
  const present = await query(`
    SELECT TOP 1 p.participant_nip, p.event_id, a.judul
    FROM dbo.training_peserta_acara p JOIN dbo.training_acara a ON a.id = p.event_id
    WHERE p.attendance_status = 'present' ORDER BY p.event_id;`);
  const absent = await query(`
    SELECT TOP 1 p.participant_nip, p.event_id, a.judul
    FROM dbo.training_peserta_acara p JOIN dbo.training_acara a ON a.id = p.event_id
    WHERE p.attendance_status <> 'present'
      AND p.participant_nip NOT IN (SELECT participant_nip FROM dbo.training_peserta_acara WHERE attendance_status = 'present')
    ORDER BY p.event_id;`);
  const outsider = await query(`
    SELECT TOP 1 NIP FROM dbo.hris_Employee
    WHERE is_Active = '1'
      AND NIP NOT IN (SELECT participant_nip FROM dbo.training_peserta_acara);`);

  if (!present.recordset[0]) {
    console.log('no attended training in the database; nothing to probe');
    await closeDatabase();
    server.close();
    return;
  }

  const attendee = present.recordset[0];
  const token = signAccessToken({
    type: 'access',
    sub: attendee.participant_nip,
    role: 'employee',
    departId: '0100',
  });
  console.log(`acting as ${attendee.participant_nip}, attended "${attendee.judul}"\n`);

  // Clear anything a previous run left behind.
  await query(
    'DELETE FROM dbo.training_certificate WHERE participant_nip = @nip;',
    (r) => r.input('nip', attendee.participant_nip),
  );

  console.log('list');
  const unauth = await call('/api/certificates/mine', null);
  expect('refuses without a session', unauth.status, 401);

  const mine = await call('/api/certificates/mine', token);
  expect('mine', mine.status, 200);
  expect('returns an array', Array.isArray(mine.body), true);
  expect('includes the attended event', mine.body.some((row) => row.eventId === attendee.event_id), true);

  const attendedRow = mine.body.find((row) => row.eventId === attendee.event_id);
  expect('attended row is flagged present', attendedRow?.hadir, true);
  expect('attended row has no certificate yet', attendedRow?.certificate, null);
  expect('row carries the title', attendedRow?.judul, attendee.judul);
  console.log(`       ${attendedRow?.judul} · ${attendedRow?.tanggal} · ${attendedRow?.pengisi ?? 'tanpa pengisi'}`);

  console.log('\nissue');
  const issued = await call(`/api/certificates/mine/${attendee.event_id}`, token, { method: 'POST' });
  expect('issue', issued.status, 201);
  expect('certificate created', issued.body.created, true);
  expect('has a verification code', /^BMC-\d{4}-\d+-[0-9A-F]{8}$/.test(issued.body.verificationCode ?? ''), true);
  expect('names the participant', Boolean(issued.body.namaPeserta), true);
  console.log(`       ${issued.body.verificationCode}`);
  createdId = issued.body.id;

  const again = await call(`/api/certificates/mine/${attendee.event_id}`, token, { method: 'POST' });
  expect('issuing twice is idempotent', again.status, 200);
  expect('same certificate returned', again.body.id, createdId);
  expect('not marked as newly created', again.body.created, false);

  const rows = await query(
    'SELECT COUNT(*) AS n FROM dbo.training_certificate WHERE participant_nip = @nip AND event_id = @e;',
    (r) => r.input('nip', attendee.participant_nip).input('e', attendee.event_id),
  );
  expect('exactly one row in the table', Number(rows.recordset[0].n), 1);

  const listed = await call('/api/certificates/mine', token);
  expect('list now shows the certificate', Boolean(listed.body.find((r) => r.eventId === attendee.event_id)?.certificate), true);

  console.log('\nrefusals');
  if (absent.recordset[0]) {
    const absentToken = signAccessToken({
      type: 'access',
      sub: absent.recordset[0].participant_nip,
      role: 'employee',
      departId: '0100',
    });
    const refused = await call(`/api/certificates/mine/${absent.recordset[0].event_id}`, absentToken, {
      method: 'POST',
    });
    expect('refused when not marked present', refused.status, 409);
    expect('refusal code', refused.body?.error?.code, 'BELUM_HADIR');
  }

  const notMine = await call(`/api/certificates/mine/999999`, token, { method: 'POST' });
  expect('unknown event', notMine.status, 404);

  if (outsider.recordset[0]) {
    const outsiderToken = signAccessToken({
      type: 'access',
      sub: outsider.recordset[0].NIP,
      role: 'employee',
      departId: '0100',
    });
    const empty = await call('/api/certificates/mine', outsiderToken);
    expect('employee with no trainings sees an empty list', empty.body.length, 0);
    const steal = await call(`/api/certificates/mine/${attendee.event_id}`, outsiderToken, { method: 'POST' });
    expect('cannot claim someone else\u2019s training', steal.status, 403);
  }

  console.log('\ncleanup');
  if (createdId) {
    await query('DELETE FROM dbo.training_certificate WHERE id = @id;', (r) => r.input('id', createdId));
  }
  const left = await query(
    'SELECT COUNT(*) AS n FROM dbo.training_certificate WHERE participant_nip = @nip;',
    (r) => r.input('nip', attendee.participant_nip),
  );
  console.log(`  certificates left behind: ${Number(left.recordset[0].n)}`);

  console.log(`\n${passed} passed, ${failed} failed`);
  await closeDatabase();
  server.close();
  if (failed > 0) process.exit(1);
};

run().catch(async (error) => {
  console.error('\nFAILED:', error.message);
  server?.close();
  await closeDatabase().catch(() => undefined);
  process.exit(1);
});
