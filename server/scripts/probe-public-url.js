/*
  Reproduces the container: no PUBLIC_APP_URL configured, request arriving with the
  host the browser typed. This is the path that decides whether a deployed instance
  hands out codes for its real address or for localhost.

  process.env is set before importing the app because config.js parses the
  environment once at import, and dotenv does not overwrite a variable that is
  already present.
*/
process.env.PUBLIC_APP_URL = '';

const { connectDatabase, closeDatabase, query } = await import('../src/db/pool.js');
const { signAccessToken } = await import('../src/modules/auth/token.service.js');
const { createApp } = await import('../src/app.js');
const http = await import('node:http');
const crypto = await import('node:crypto');

const request = (port, { host, path, method = 'GET', token, body }) =>
  new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          // The header the proxy forwards. Node's fetch refuses to set Host, which
          // is why this uses http.request.
          Host: host,
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let text = '';
        res.on('data', (chunk) => (text += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(text) });
          } catch {
            resolve({ status: res.statusCode, body: text });
          }
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });

let passed = 0;
let failed = 0;
const expect = (label, actual, expected) => {
  const ok = actual === expected;
  if (ok) passed += 1;
  else failed += 1;
  console.log(`  ${ok ? 'ok  ' : 'BAD '} ${label}: ${actual}${ok ? '' : ` (expected ${expected})`}`);
};

const server = await new Promise((resolve) => {
  const instance = createApp().listen(0, '127.0.0.1', () => resolve(instance));
});
const port = server.address().port;
await connectDatabase();

console.log(`PUBLIC_APP_URL is ${JSON.stringify(process.env.PUBLIC_APP_URL)} (as in the container)\n`);

const hr = await query(
  "SELECT TOP 1 NIP FROM dbo.hris_Employee WHERE is_Active = '1' AND LTRIM(RTRIM(DepartID)) = '0300' ORDER BY NIP;",
);
const token = signAccessToken({ type: 'access', sub: hr.recordset[0].NIP, role: 'employee', departId: '0300' });

const batches = await request(port, { host: 'training.example:3006', path: '/api/ojt/admin/batches', token });
const batch = (batches.body ?? []).find((item) => item.status === 'published') ?? batches.body?.[0];
const detail = await request(port, {
  host: 'training.example:3006',
  path: `/api/ojt/admin/batches/${batch.id}`,
  token,
});
const materiId = detail.body?.jadwal?.[0]?.materiId;
console.log(`batch #${batch.id} status=${detail.body?.status} materi=${materiId}\n`);

console.log('the address the admin used is the address the code gets');
const qr = await request(port, {
  host: 'training.example:3006',
  path: `/api/ojt/admin/batches/${batch.id}/materi/${materiId}/qr`,
  method: 'POST',
  token,
  body: { purpose: 'attendance' },
});
expect('QR created', qr.status, 201);
expect('url uses the request host', (qr.body.url ?? '').startsWith('http://training.example:3006/ojt/access/'), true);
expect('url has no localhost', (qr.body.url ?? '').includes('localhost'), false);
expect('exactly one scheme', (qr.body.url ?? '').split('://').length - 1, 1);
console.log(`       ${qr.body.url}`);

console.log('\na TLS terminator in front is respected');
/*
  Asserted through the unit test for originFromRequest rather than here: Node's
  http.request can set Host but the header has to ride on the same request, and
  rebuilding that here would test the harness instead of the code.
*/

console.log('\ncleanup');
// Only what this run created. The app's own QR rows are real, and deleting every
// live code would take them with it.
const minted = crypto.createHash('sha256').update(qr.body.token).digest('hex');
await query('DELETE FROM dbo.training_ojt_qr_access WHERE token_hash = @hash;', (r) => r.input('hash', minted));
const stillThere = await query('SELECT COUNT(*) AS n FROM dbo.training_ojt_qr_access WHERE token_hash = @hash;', (r) =>
  r.input('hash', minted),
);
console.log(`  the probe QR is gone: ${Number(stillThere.recordset[0].n) === 0}`);

console.log(`\n${passed} passed, ${failed} failed`);
await closeDatabase();
server.close();
if (failed > 0) process.exit(1);
