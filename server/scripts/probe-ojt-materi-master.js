import { connectDatabase, closeDatabase, query } from '../src/db/pool.js';
import { signAccessToken } from '../src/modules/auth/token.service.js';
import { createApp } from '../src/app.js';

/*
  Exercises the master material endpoints against the real database through the
  real router, then removes whatever it created.

  This exists because a 401 from curl proves nothing: authenticate() runs before
  the router matches anything, so an unknown path answers 401 too. Only a minted
  token tells you whether the route is registered and whether the SQL works.
*/
let server;
let baseUrl;

const request = async (path, token, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* not json, keep the raw text */
  }
  return { status: response.status, body };
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
  const nip = hr.recordset[0]?.NIP ?? '0001';
  const token = signAccessToken({ type: 'access', sub: nip, role: 'employee', departId: '0300' });
  console.log(`acting as NIP ${nip}\n`);

  const created = [];

  const list = await request('/api/ojt/admin/materi/master', token);
  console.log(`GET  /materi/master      -> ${list.status}`);
  console.log(`     ${JSON.stringify(list.body).slice(0, 200)}`);

  const nama = `PROBE-${Date.now()}`;
  const post = await request('/api/ojt/admin/materi/master', token, {
    method: 'POST',
    body: JSON.stringify({ nama, deskripsi: 'probe' }),
  });
  console.log(`\nPOST /materi/master      -> ${post.status}`);
  console.log(`     ${JSON.stringify(post.body)}`);
  if (post.status === 201) created.push(post.body.id);

  const duplicate = await request('/api/ojt/admin/materi/master', token, {
    method: 'POST',
    body: JSON.stringify({ nama }),
  });
  console.log(`\nPOST duplicate name       -> ${duplicate.status}`);
  console.log(`     ${JSON.stringify(duplicate.body)}`);

  const blank = await request('/api/ojt/admin/materi/master', token, {
    method: 'POST',
    body: JSON.stringify({ nama: '   ' }),
  });
  console.log(`\nPOST blank name           -> ${blank.status}`);
  console.log(`     ${JSON.stringify(blank.body)}`);

  if (created.length > 0) {
    const id = created[0];
    const patched = await request(`/api/ojt/admin/materi/master/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ deskripsi: 'probe diubah' }),
    });
    console.log(`\nPATCH /materi/master/:id -> ${patched.status}`);
    console.log(`     ${JSON.stringify(patched.body)}`);

    const moved = await request(`/api/ojt/admin/materi/master/${id}/move`, token, {
      method: 'POST',
      body: JSON.stringify({ direction: -1 }),
    });
    console.log(`\nPOST move direction -1    -> ${moved.status}`);
    console.log(`     ${JSON.stringify(moved.body)}`);

    const off = await request(`/api/ojt/admin/materi/master/${id}/aktif`, token, {
      method: 'PATCH',
      body: JSON.stringify({ aktif: false }),
    });
    console.log(`\nPATCH aktif=false         -> ${off.status}`);
    console.log(`     ${JSON.stringify(off.body)}`);

    const missing = await request('/api/ojt/admin/materi/master/999999', token, {
      method: 'PATCH',
      body: JSON.stringify({ nama: 'x' }),
    });
    console.log(`\nPATCH unknown id          -> ${missing.status}`);
    console.log(`     ${JSON.stringify(missing.body)}`);

    await query('DELETE FROM dbo.training_ojt_materi WHERE id = @id;', (request) =>
      request.input('id', created[0]),
    );
    console.log('\ncleaned up probe rows');
  }

  const after = await request('/api/ojt/admin/materi/master', token);
  console.log(`\nactive after cleanup     : ${after.body.filter((m) => m.aktif).length}`);
  console.log(`all rows after cleanup   : ${after.body.length}`);

  await closeDatabase();
  server.close();
};

run().catch(async (error) => {
  console.error('\nFAILED:', error.message);
  server?.close();
  await closeDatabase().catch(() => undefined);
  process.exit(1);
});
