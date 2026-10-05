import { connectDatabase, closeDatabase, query } from '../src/db/pool.js';
import { signAccessToken } from '../src/modules/auth/token.service.js';
import { createApp } from '../src/app.js';

/*
  Drives the whole per-material assessment chain against the real database, as a
  participant would, then removes everything it created.

  The case that matters most is the last one: two materials on the same day, one
  participant, two attendance scans. Under the old UNIQUE(peserta, tanggal) that
  second scan was refused with "already recorded", which is the whole reason
  attendance had to be re-keyed. If that scan still fails, the migration did not
  do what it claims.

  Everything else existed to pass a schema test while the write path was broken
  three times, so nothing here is taken on trust from the unit suite.
*/
let server;
let baseUrl;

/*
  Held at module scope so the failure path can put the batch status back too.

  This probe writes to a real batch: it has to publish it to get past the gate, and
  closing and reopening are part of what it verifies. An earlier version restored
  the status only on the success path, so any thrown error left somebody's real
  batch in a state they never chose. Restoring in the catch as well is the whole
  reason these live out here.
*/
let restoreBatch = null;

const restoreOriginalStatus = async () => {
  if (typeof restoreBatch !== 'function') return;
  const restore = restoreBatch;
  restoreBatch = null;
  await restore().catch(() => undefined);
};

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
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: response.status, body };
};

const check = (label, actual, expected) => {
  const ok = actual === expected;
  console.log(`  ${ok ? 'ok  ' : 'BAD '} ${label}: ${actual}${ok ? '' : ` (expected ${expected})`}`);
  return ok;
};

let passed = 0;
let failed = 0;
const expect = (label, actual, expected) => {
  if (check(label, actual, expected)) passed += 1;
  else failed += 1;
};

const run = async () => {
  server = await new Promise((resolve) => {
    const instance = createApp().listen(0, '127.0.0.1', () => resolve(instance));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  await connectDatabase();

  /*
    Sweep before asserting anything. A previous run that failed partway leaves its
    rows behind, and because attendance and results are queried per participant
    and per batch rather than per run, those leftovers would show up as failures
    of this run. Counts below are only meaningful against a clean slate.
  */
  const purgeProbes = async () => {
    const targets = await query(
      "SELECT id FROM dbo.training_ojt_materi WHERE nama LIKE 'PROBE-A-%' OR nama LIKE 'PROBE-B-%';",
    );
    const ids = targets.recordset.map((row) => row.id);
    if (ids.length === 0) return 0;
    for (const id of ids) {
      /*
        Child first, in foreign key order. Deleting answer_pg before
        answer_grade_pg fails on the grade's reference, which is how an earlier
        version of this script left rows behind and made itself look broken.
      */
      await query(
        `DELETE g FROM dbo.training_ojt_answer_grade_pg g
         JOIN dbo.training_ojt_answer_pg a ON a.id = g.answer_id
         JOIN dbo.training_ojt_test_session s ON s.id = a.session_id
         JOIN dbo.training_ojt_test_set t ON t.id = s.test_set_id WHERE t.materi_id = @id;`,
        (r) => r.input('id', id),
      );
      await query(
        `DELETE a FROM dbo.training_ojt_answer_pg a
         JOIN dbo.training_ojt_test_session s ON s.id = a.session_id
         JOIN dbo.training_ojt_test_set t ON t.id = s.test_set_id WHERE t.materi_id = @id;`,
        (r) => r.input('id', id),
      );
      await query(
        `DELETE g FROM dbo.training_ojt_answer_grade_essay g
         JOIN dbo.training_ojt_answer_essay a ON a.id = g.answer_id
         JOIN dbo.training_ojt_test_session s ON s.id = a.session_id
         JOIN dbo.training_ojt_test_set t ON t.id = s.test_set_id WHERE t.materi_id = @id;`,
        (r) => r.input('id', id),
      );
      await query(
        `DELETE a FROM dbo.training_ojt_answer_essay a
         JOIN dbo.training_ojt_test_session s ON s.id = a.session_id
         JOIN dbo.training_ojt_test_set t ON t.id = s.test_set_id WHERE t.materi_id = @id;`,
        (r) => r.input('id', id),
      );
      await query(
        `DELETE s FROM dbo.training_ojt_test_session s
         JOIN dbo.training_ojt_test_set t ON t.id = s.test_set_id WHERE t.materi_id = @id;`,
        (r) => r.input('id', id),
      );
      await query(
        `DELETE FROM dbo.training_ojt_question_pg WHERE test_set_id IN (SELECT id FROM dbo.training_ojt_test_set WHERE materi_id = @id);`,
        (r) => r.input('id', id),
      );
      await query(
        `DELETE FROM dbo.training_ojt_question_essay WHERE test_set_id IN (SELECT id FROM dbo.training_ojt_test_set WHERE materi_id = @id);`,
        (r) => r.input('id', id),
      );
      await query('DELETE FROM dbo.training_ojt_test_set WHERE materi_id = @id;', (r) => r.input('id', id));
      await query('DELETE FROM dbo.training_ojt_feedback WHERE materi_id = @id;', (r) => r.input('id', id));
      await query('DELETE FROM dbo.training_ojt_absensi WHERE materi_id = @id;', (r) => r.input('id', id));
      await query('DELETE FROM dbo.training_ojt_qr_access WHERE materi_id = @id;', (r) => r.input('id', id));
      await query('DELETE FROM dbo.training_ojt_jadwal_materi WHERE materi_id = @id;', (r) => r.input('id', id));
      await query('DELETE FROM dbo.training_ojt_materi WHERE id = @id;', (r) => r.input('id', id));
    }
    return ids.length;
  };

  const swept = await purgeProbes();
  if (swept > 0) console.log(`swept ${swept} leftover probe material(s) from an earlier run\n`);
  const hr = await query(
    "SELECT TOP 1 e.NIP FROM dbo.hris_Employee e WHERE e.is_Active = '1' AND LTRIM(RTRIM(e.DepartID)) = '0300' ORDER BY e.NIP;",
  );
  const nip = hr.recordset[0]?.NIP ?? '0001';
  const admin = signAccessToken({ type: 'access', sub: nip, role: 'employee', departId: '0300' });

  const batches = await call('/api/ojt/admin/batches', admin);
  const batchId = batches.body[0]?.id;
  if (!batchId) {
    console.log('no batch to probe against');
    await closeDatabase();
    server.close();
    return;
  }
  const detail = await call(`/api/ojt/admin/batches/${batchId}`, admin);
  const tanggal = detail.body.tanggalMulai;
  console.log(`batch #${batchId}, window ${detail.body.tanggalMulai} .. ${detail.body.tanggalSelesai}\n`);

  const setStatus = async (status) => {
    const result = await call(`/api/ojt/admin/batches/${batchId}/status`, admin, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return result;
  };

  /*
    Remembered so the probe leaves the batch the way it found it. It has to publish
    the batch to get any further, and a probe that silently left somebody's real
    batch published would be its own kind of damage.
  */
  const originalStatus = detail.body.status;

  /*
    Registered as soon as the status is known, not at the end of the happy path,
    so every exit route restores it.
  */
  restoreBatch = () => setStatus(originalStatus);

  console.log('batch status gates everything participants do');
  const draft = await setStatus('draft');
  expect('set draft', draft.status, 200);

  const materiDraft = `PROBE-DRAFT-${Date.now()}`;
  await call(`/api/ojt/admin/batches/${batchId}/jadwal`, admin, {
    method: 'POST',
    body: JSON.stringify({ tanggal, namaMateri: materiDraft }),
  });
  const afterDraft = await call(`/api/ojt/admin/batches/${batchId}`, admin);
  const draftMateriId = afterDraft.body.jadwal.find((j) => j.materiNama === materiDraft)?.materiId;

  const qrOnDraft = await call(`/api/ojt/admin/batches/${batchId}/materi/${draftMateriId}/qr`, admin, {
    method: 'POST',
    body: JSON.stringify({ purpose: 'attendance' }),
  });
  expect('QR refused while draft', qrOnDraft.status, 409);
  expect('draft code', qrOnDraft.body?.error?.code, 'BATCH_BELUM_TERBIT');

  // Clean the draft probe material up now so it does not linger if a later step fails.
  await query('DELETE FROM dbo.training_ojt_jadwal_materi WHERE materi_id = @id;', (r) =>
    r.input('id', draftMateriId),
  );
  await query('DELETE FROM dbo.training_ojt_materi WHERE id = @id;', (r) => r.input('id', draftMateriId));

  const reopened = await setStatus('published');
  expect('set published', reopened.status, 200);

  // A second day is needed for two materials, so widen nothing: both go on day one
  // and attendance has to accept both.
  const stamp = Date.now();
  const materiA = `PROBE-A-${stamp}`;
  const materiB = `PROBE-B-${stamp}`;

  console.log('schedule two materials on the same day');
  const jadwalA = await call(`/api/ojt/admin/batches/${batchId}/jadwal`, admin, {
    method: 'POST',
    body: JSON.stringify({ tanggal, namaMateri: materiA }),
  });
  expect('schedule material A', jadwalA.status, 201);
  const jadwalB = await call(`/api/ojt/admin/batches/${batchId}/jadwal`, admin, {
    method: 'POST',
    body: JSON.stringify({ tanggal, namaMateri: materiB }),
  });
  expect('schedule material B', jadwalB.status, 201);

  console.log('\nrefuse the same material twice in one batch');
  const dupe = await call(`/api/ojt/admin/batches/${batchId}/jadwal`, admin, {
    method: 'POST',
    body: JSON.stringify({ tanggal, namaMateri: materiA }),
  });
  expect('duplicate schedule', dupe.status, 409);
  expect('duplicate code', dupe.body?.error?.code, 'MATERI_SUDAH_DIJADWALKAN');

  const materiAId = jadwalA.body ? detail.body.jadwal.find((j) => j.materiNama === materiA)?.materiId : null;
  const jadwal = await call(`/api/ojt/admin/batches/${batchId}`, admin);
  const idA = jadwal.body.jadwal.find((j) => j.materiNama === materiA)?.materiId;
  const idB = jadwal.body.jadwal.find((j) => j.materiNama === materiB)?.materiId;
  void materiAId;
  expect('material A resolved', typeof idA, 'number');
  expect('material B resolved', typeof idB, 'number');

  console.log('\nreadiness before any questions exist');
  const early = await call(`/api/ojt/admin/batches/${batchId}/assessment`, admin);
  expect('summary status', early.status, 200);
  const earlyA = early.body.find((row) => row.materiId === idA);
  expect('A has no bank', earlyA?.testSetId, null);
  expect('A not test ready', earlyA?.siapUntukUji, false);

  console.log('\nbuild and publish one bank');
  const ensure = await call(`/api/ojt/admin/materi/${idA}/test-set`, admin, { method: 'POST' });
  expect('ensure creates bank', ensure.status, 201);
  expect('bank flagged created', ensure.body.created, true);
  const setId = ensure.body.id;
  const ensureAgain = await call(`/api/ojt/admin/materi/${idA}/test-set`, admin, { method: 'POST' });
  expect('ensure reuses bank', ensureAgain.status, 200);
  expect('same bank id', ensureAgain.body.id, setId);

  const publishEmpty = await call(`/api/ojt/admin/test-sets/${setId}/publish`, admin, { method: 'POST' });
  expect('publish with no questions refused', publishEmpty.status, 409);

  const q1 = await call(`/api/ojt/admin/test-sets/${setId}/questions`, admin, {
    method: 'POST',
    body: JSON.stringify({
      type: 'pg',
      text: 'Apa yang pertama dilakukan saat menemukan api terbakar?',
      a: 'MeneleponIntroduction',
      b: 'Mematikan sumber api',
      c: 'Menyembunyikan api',
      d: 'Menunggu所有人',
      correct: 'B',
      point: 10,
    }),
  });
  expect('add question', q1.status, 201);

  const publish = await call(`/api/ojt/admin/test-sets/${setId}/publish`, admin, { method: 'POST' });
  expect('publish', publish.status, 200);
  const afterPublish = await call(`/api/ojt/admin/materi/${idA}/test-set`, admin);
  expect('question count locked in', afterPublish.body.questionCount, 1);

  const ready = await call(`/api/ojt/admin/batches/${batchId}/assessment`, admin);
  const readyA = ready.body.find((row) => row.materiId === idA);
  expect('A now test ready', readyA?.siapUntukUji, true);
  const readyB = ready.body.find((row) => row.materiId === idB);
  expect('B still not test ready', readyB?.siapUntukUji, false);

  console.log('\nQR per material, and only for scheduled materials');
  const qrPre = await call(`/api/ojt/admin/batches/${batchId}/materi/${idA}/qr`, admin, {
    method: 'POST',
    body: JSON.stringify({ purpose: 'pre_test' }),
  });
  expect('pre-test QR', qrPre.status, 201);
  /*
    The URL is what gets encoded into the QR image and copied to the clipboard, so
    it has to be absolute. A relative path scans into a dead address, and that was
    the shape before PUBLIC_APP_URL existed.
  */
  expect('QR url is absolute', /^https?:\/\/[^/]+\/ojt\/access\/.+/.test(qrPre.body.url ?? ''), true);
  console.log(`       ${qrPre.body.url}`);
  const qrPreAgain = await call(`/api/ojt/admin/batches/${batchId}/materi/${idA}/qr`, admin, {
    method: 'POST',
    body: JSON.stringify({ purpose: 'pre_test' }),
  });
  expect('second pre-test QR issued', qrPreAgain.status, 201);
  /*
    Issuing no longer retires the previous code. It used to, and the effect was that
    a printed code died the next time somebody opened the dialog, with nothing on
    screen to say so and no way to get that code back, since only its hash is kept.
  */
  const liveAfterSecond = await query(
    'SELECT COUNT(*) AS n FROM dbo.training_ojt_qr_access WHERE batch_id = @b AND materi_id = @m AND purpose = @p AND revoked_at IS NULL;',
    (r) => r.input('b', batchId).input('m', idA).input('p', 'pre_test'),
  );
  expect('issuing again leaves both codes live', Number(liveAfterSecond.recordset[0].n), 2);

  const firstStillWorks = await call(`/api/ojt/access/${qrPre.body.token}`, {});
  expect('the first code still resolves', firstStillWorks.status, 200);

  const revokedNow = await call(`/api/ojt/admin/batches/${batchId}/materi/${idA}/qr?purpose=pre_test`, admin, {
    method: 'DELETE',
  });
  expect('revoking retires every live code', revokedNow.body?.revoked, 2);

  const refused = await call(`/api/ojt/access/${qrPre.body.token}`, {});
  expect('a revoked code is refused', refused.status, 404);
  expect('and says so', refused.body?.error?.code, 'QR_EXPIRED');

  // Reissue, because the rest of the run needs a working pre-test code.
  const reissued = await call(`/api/ojt/admin/batches/${batchId}/materi/${idA}/qr`, admin, {
    method: 'POST',
    body: JSON.stringify({ purpose: 'pre_test' }),
  });
  expect('reissued after revoking', reissued.status, 201);
  qrPreAgain.body.token = reissued.body.token;

  const qrWrongMateri = await call(`/api/ojt/admin/batches/${batchId}/materi/999999/qr`, admin, {
    method: 'POST',
    body: JSON.stringify({ purpose: 'pre_test' }),
  });
  expect('QR for unscheduled material', qrWrongMateri.status, 400);
  expect('QR rejection code', qrWrongMateri.body?.error?.code, 'MATERI_TIDAK_DIJADWALKAN');

  console.log('\nparticipant flow: open, answer pre-test');
  const access = await call(`/api/ojt/access/${qrPreAgain.body.token}`, {});
  expect('access payload', access.status, 200);
  expect('access names the material', access.body.materiNama, materiA);
  expect('access carries the date', access.body.materiTanggal, tanggal);

  /*
    The name picker needs the batch roster, so it is in the payload. It is the one
    list a QR holder can read without an account, which makes what it does *not*
    contain as important as what it does.
  */
  const roster = access.body.peserta;
  expect('roster is an array', Array.isArray(roster), true);
  expect('roster is not empty', roster.length > 0, true);
  const rosterKeys = [...new Set(roster.flatMap((row) => Object.keys(row)))].sort();
  expect('roster exposes only name and code', rosterKeys.join(','), 'kodePeserta,namaLengkap');
  expect(
    'roster carries no department or position',
    roster.some((row) => 'departemen' in row || 'jabatan' in row || 'tanggalMasuk' in row),
    false,
  );
  const rosterIds = new Set(roster.map((row) => row.kodePeserta));
  const batchIds = new Set(detail.body.peserta.map((row) => row.kodePeserta));
  expect(
    'roster is scoped to this batch',
    [...rosterIds].every((id) => batchIds.has(id)) && rosterIds.size === batchIds.size,
    true,
  );

  const peserta = detail.body.peserta[0];
  if (!peserta) {
    console.log('\nno participant in this batch, skipping the participant half');
  } else {
    const opened = await call(`/api/ojt/access/${qrPreAgain.body.token}/open`, {}, {
      method: 'POST',
      body: JSON.stringify({ kodePeserta: peserta.kodePeserta }),
    });
    expect('open pre-test', opened.status, 200);
    expect('questions returned', Array.isArray(opened.body.questions) && opened.body.questions.length, 1);
    expect('phase is pre', opened.body.phase, 'pre');

    /*
      The picker hands back a code, and the code is still what the server matches
      on. Selecting a name is a way to get the code, not a replacement for it, so
      the identity guarantee is unchanged.
    */
    const pickedFromRoster = roster.find((row) => row.kodePeserta === peserta.kodePeserta);
    expect('selected participant is in the roster', Boolean(pickedFromRoster), true);
    expect('roster name matches the batch', pickedFromRoster?.namaLengkap, peserta.namaLengkap);

    const submitted = await call(`/api/ojt/access/${qrPreAgain.body.token}/submit`, {}, {
      method: 'POST',
      body: JSON.stringify({
        kodePeserta: peserta.kodePeserta,
        sessionId: opened.body.sessionId,
        answers: [{ questionId: opened.body.questions[0].id, answer: 'B' }],
      }),
    });
    expect('submit pre-test', submitted.status, 200);

    const locked = await call(`/api/ojt/access/${qrPreAgain.body.token}/open`, {}, {
      method: 'POST',
      body: JSON.stringify({ kodePeserta: peserta.kodePeserta }),
    });
    expect('locked pre-test refuses re-entry', locked.status, 409);
    expect('re-entry code', locked.body?.error?.code, 'ALREADY_SUBMITTED');

    console.log('\nfeedback is scoped to the material');
    const qrFeedbackA = await call(`/api/ojt/admin/batches/${batchId}/materi/${idA}/qr`, admin, {
      method: 'POST',
      body: JSON.stringify({ purpose: 'feedback' }),
    });
    expect('feedback QR for A', qrFeedbackA.status, 201);
    const fbA = await call(`/api/ojt/access/${qrFeedbackA.body.token}/feedback`, {}, {
      method: 'POST',
      body: JSON.stringify({
        kodePeserta: peserta.kodePeserta,
        entries: [{ aspect: 'Penjelasan', score: 4, comment: 'jelas' }],
      }),
    });
    expect('submit feedback for A', fbA.status, 200);
    const fbRows = await query(
      'SELECT COUNT(*) AS n FROM dbo.training_ojt_feedback WHERE materi_id = @m;',
      (r) => r.input('m', idA),
    );
    expect('feedback rows for A', Number(fbRows.recordset[0].n), 1);
    const fbOther = await query(
      'SELECT COUNT(*) AS n FROM dbo.training_ojt_feedback WHERE materi_id = @m;',
      (r) => r.input('m', idB),
    );
    expect('no feedback leaked to B', Number(fbOther.recordset[0].n), 0);

    console.log('\nattendance: two materials, same participant, same day');
    const qrAbsA = await call(`/api/ojt/admin/batches/${batchId}/materi/${idA}/qr`, admin, {
      method: 'POST',
      body: JSON.stringify({ purpose: 'attendance' }),
    });
    expect('attendance QR for A', qrAbsA.status, 201);
    const absA = await call(`/api/ojt/access/${qrAbsA.body.token}/open`, {}, {
      method: 'POST',
      body: JSON.stringify({ kodePeserta: peserta.kodePeserta, signatureData: 'sig-a' }),
    });
    expect('attendance for A recorded', absA.status, 200);
    expect('recorded against the material date', absA.body.tanggal, tanggal);

    const absA2 = await call(`/api/ojt/access/${qrAbsA.body.token}/open`, {}, {
      method: 'POST',
      body: JSON.stringify({ kodePeserta: peserta.kodePeserta, signatureData: 'sig-a-again' }),
    });
    expect('rescan of A refused', absA2.status, 409);

    const qrAbsB = await call(`/api/ojt/admin/batches/${batchId}/materi/${idB}/qr`, admin, {
      method: 'POST',
      body: JSON.stringify({ purpose: 'attendance' }),
    });
    expect('attendance QR for B', qrAbsB.status, 201);
    const absB = await call(`/api/ojt/access/${qrAbsB.body.token}/open`, {}, {
      method: 'POST',
      body: JSON.stringify({ kodePeserta: peserta.kodePeserta, signatureData: 'sig-b' }),
    });
    /*
      The assertion that justifies the migration. Under UNIQUE(peserta, tanggal)
      this was ALREADY_SUBMITTED and per-material attendance could not exist.
    */
    expect('attendance for B recorded on the same day', absB.status, 200);
    expect('B names its own material', absB.body.materiNama, materiB);

    const absRows = await query(
      'SELECT COUNT(*) AS n FROM dbo.training_ojt_absensi WHERE peserta_id = @p AND tanggal = @t;',
      (r) => r.input('p', peserta.id).input('t', tanggal),
    );
    expect('two attendance rows for one participant one day', Number(absRows.recordset[0].n), 2);

    console.log('\nresults list every participant, including the ones who did nothing');
    const results = await call(`/api/ojt/admin/batches/${batchId}/results`, admin);
    expect('results status', results.status, 200);

    const forA = results.body.byMateri.find((row) => row.materiNama === materiA);
    const forB = results.body.byMateri.find((row) => row.materiNama === materiB);
    expect('results include A', Boolean(forA), true);
    expect('results include B', Boolean(forB), true);

    /*
      The reason this view was rebuilt. Listing sessions could only ever show who
      had worked; the roster has to be the starting point or the people who have
      not started are invisible, which is exactly who the report is for.
    */
    expect('roster row count matches the batch', forA?.peserta.length, detail.body.peserta.length);

    const mine = forA.peserta.find((row) => row.kodePeserta === peserta.kodePeserta);
    expect('my pre-test is scored', mine?.pre.state, 'selesai');
    expect('full marks', mine?.pre.percentage, 100);
    expect('my post-test is untouched', mine?.post.state, 'belum');
    expect('untouched has no score', mine?.post.percentage, null);

    const others = forA.peserta.filter((row) => row.kodePeserta !== peserta.kodePeserta);
    if (others.length > 0) {
      expect(
        'everyone else reads as not started',
        others.every((row) => row.pre.state === 'belum' && row.post.state === 'belum'),
        true,
      );
    }

    /* Material B has no question bank, so nobody can have a score against it. */
    expect('B has no scores', forB.peserta.every((row) => row.pre.state === 'belum'), true);
    /*
      The breakdown has one row per material scheduled in the batch, which
      includes whatever else this batch already had on the calendar. Asserting a
      total would couple the probe to the batch's real contents, so check that
      both probe materials are named instead.
    */
    const breakdownNames = results.body.attendanceByMateri.map((row) => row.materiNama);
    expect('breakdown includes A', breakdownNames.includes(materiA), true);
    expect('breakdown includes B', breakdownNames.includes(materiB), true);
    const rowB = results.body.attendanceByMateri.find((row) => row.materiNama === materiB);
    expect('B attendance counted', rowB?.hadir, 1);
    const rowA = results.body.attendanceByMateri.find((row) => row.materiNama === materiA);
    expect('A attendance counted', rowA?.hadir, 1);

    /*
      The closed row shows a count; the detail is who. A count nobody can act on
      is what the modal exists to replace, so the list has to cover everyone, not
      just the ones who showed.
    */
    expect('attendance detail covers the roster', rowA?.peserta.length, detail.body.peserta.length);
    const came = rowA.peserta.filter((row) => row.hadir);
    const missed = rowA.peserta.filter((row) => !row.hadir);
    expect('one participant came', came.length, 1);
    expect('the participant who came is me', came[0]?.kodePeserta, peserta.kodePeserta);
    expect('the rest are listed as missing', missed.length, detail.body.peserta.length - 1);
    expect(
      'nobody is both present and absent',
      rowA.peserta.every((row) => typeof row.hadir === 'boolean'),
      true,
    );
    expect('detail names every participant', rowA.peserta.every((row) => Boolean(row.namaLengkap)), true);
  }

  console.log('\nclosing the batch stops collection, and reopening restores it');
  const closed = await setStatus('closed');
  expect('set closed', closed.status, 200);

  const qrWhenClosed = await call(`/api/ojt/admin/batches/${batchId}/materi/${idA}/qr`, admin, {
    method: 'POST',
    body: JSON.stringify({ purpose: 'attendance' }),
  });
  expect('QR refused while closed', qrWhenClosed.status, 409);
  expect('closed code', qrWhenClosed.body?.error?.code, 'BATCH_DITUTUP');

  /*
    The reason closing has to reach the participant routes and not only the QR
    route: the code in somebody's hand was issued while the batch was open, so
    refusing only new codes would let the old one straight through.
  */
  const openWhenClosed = await call(`/api/ojt/access/${qrPreAgain.body.token}`, {});
  expect('participant page refused when closed', openWhenClosed.status, 409);
  expect('participant code', openWhenClosed.body?.error?.code, 'BATCH_DITUTUP');

  const submitWhenClosed = await call(`/api/ojt/access/${qrPreAgain.body.token}/open`, {}, {
    method: 'POST',
    body: JSON.stringify({ kodePeserta: peserta.kodePeserta }),
  });
  expect('open refused when closed', submitWhenClosed.status, 409);

  const backOpen = await setStatus('published');
  expect('reopen', backOpen.status, 200);
  const afterReopen = await call(`/api/ojt/access/${qrPreAgain.body.token}`, {});
  expect('participant page works again after reopening', afterReopen.status, 200);

  console.log('\ncleanup');
  await restoreOriginalStatus();
  await purgeProbes();

  const leftovers = await query(
    `SELECT
       (SELECT COUNT(*) FROM dbo.training_ojt_materi WHERE nama LIKE 'PROBE-%') AS m,
       (SELECT COUNT(*) FROM dbo.training_ojt_jadwal_materi WHERE materi_id NOT IN (SELECT id FROM dbo.training_ojt_materi)) AS orphan_jadwal;`,
  );
  console.log(`  probe materi left: ${leftovers.recordset[0].m}`);
  console.log(`  orphan jadwal left: ${leftovers.recordset[0].orphan_jadwal}`);

  console.log(`\n${passed} passed, ${failed} failed`);
  await closeDatabase();
  server.close();
  if (failed > 0) process.exit(1);
};

run().catch(async (error) => {
  console.error('\nFAILED:', error.message);
  await restoreOriginalStatus();
  server?.close();
  await closeDatabase().catch(() => undefined);
  process.exit(1);
});