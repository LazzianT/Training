/**
 * Imports the legacy MySQL dump into the training_* tables.
 *
 * Writes only to training_* tables. Never touches hris_Employee or any other
 * existing table. Every row that cannot be migrated is written to
 * training_migration_map as 'rejected' with a reason, so nothing disappears
 * silently.
 *
 * schedule_creator is deliberately not imported: it holds NONIK and a plaintext
 * PASSWORD, and nothing in this system authenticates against it.
 *
 * Usage: corepack pnpm --filter @training/server migrate:data
 */
import sql from 'mssql';
import { readDump } from './lib/legacy-dump.js';
import { connectDatabase, closeDatabase, query } from '../src/db/pool.js';

const DUMP = 'D:/Lazzian Al Falah/Application/training/training.sql';

const tables = await readDump(DUMP);
await connectDatabase();

const rejects = [];
const rejectIndex = new Map();
const stats = {};

const count = (table, inserted, skipped) => {
  const entry = (stats[table] ??= { inserted: 0, skipped: 0 });
  entry.inserted += inserted;
  entry.skipped += skipped;
};

/**
 * training_migration_map is unique on (source_table, source_id), so one legacy
 * row yields at most one map row. Extra reasons are appended to it.
 */
const reject = (table, id, reason) => {
  const key = `${table}|${id}`;
  const existing = rejectIndex.get(key);
  if (existing) {
    existing.reasons.push(reason);
    return;
  }
  const entry = { table, id: String(id), reasons: [reason] };
  rejectIndex.set(key, entry);
  rejects.push(entry);
};

/**
 * Values are bound with the widest type that is still safe, so nvarchar(max)
 * text from the dump is never truncated and numeric columns stay numeric.
 */
const bindValues = (request, values) => {
  values.forEach((value, index) => {
    const name = `p${index}`;
    if (value === null || value === undefined) request.input(name, sql.NVarChar(sql.MAX), null);
    else if (typeof value === 'number') request.input(name, sql.Decimal(18, 4), value);
    else if (typeof value === 'boolean') request.input(name, sql.Bit, value ? 1 : 0);
    else request.input(name, sql.NVarChar(sql.MAX), String(value));
  });
  return request;
};

/**
 * T-SQL puts the OUTPUT clause between the column list and VALUES. Only tables
 * whose generated id is needed downstream ask for it, because some target
 * tables are keyed on a natural column and have no `id` at all.
 */
const insertSql = (table, columns, withOutput) =>
  `INSERT INTO dbo.${table} (${columns.join(', ')}) ${withOutput ? 'OUTPUT INSERTED.id ' : ''}VALUES (${columns
    .map((_, index) => `@p${index}`)
    .join(', ')});`;

const run = (text, values) => query(text, (request) => bindValues(request, values));

const insert = (table, columns, values) => run(insertSql(table, columns, false), values);

const insertReturningId = async (table, columns, values) => {
  const { recordset } = await run(insertSql(table, columns, true), values);
  return recordset[0].id;
};

// --- NIP resolution ---------------------------------------------------------
// Legacy NIPs are unpadded numbers, hris_Employee.NIP is a 4 char varchar.

const canonicalNip = (raw) => {
  const value = String(raw ?? '').trim();
  return value === '' ? null : value.length < 4 ? value.padStart(4, '0') : value;
};

const nipMap = await (async () => {
  const raw = new Set();
  for (const table of [
    'peserta_acara',
    'absensi_training',
    'user_feedback',
    'trainer_feedback',
    'essay_jawaban_user',
    'jawaban_user',
  ]) {
    for (const row of tables.get(table) ?? []) raw.add(String(row.nik_peserta ?? '').trim());
  }
  for (const row of tables.get('induk_master_soal') ?? []) raw.add(String(row.id_trainer ?? '').trim());

  const candidates = [
    ...new Set(
      [...raw].flatMap((value) => [value, canonicalNip(value), canonicalNip(value)?.replace(/^0+/, '')]).filter(Boolean),
    ),
  ];

  const { recordset } = await query(
    `SELECT NIP, LTRIM(RTRIM(Name)) AS name, LTRIM(RTRIM(DepartID)) AS depart_id
     FROM dbo.hris_Employee
     WHERE NIP IN (SELECT [value] FROM OPENJSON(@json));`,
    (request) => request.input('json', sql.NVarChar(sql.MAX), JSON.stringify(candidates)),
  );

  const byNip = new Map(recordset.map((row) => [row.NIP, row]));
  return new Map(
    [...raw].map((value) => [value, byNip.get(value) ?? byNip.get(canonicalNip(value))]).filter(([, hit]) => hit),
  );
})();

const nipOf = (raw) => nipMap.get(String(raw ?? '').trim())?.NIP ?? canonicalNip(raw);
const nameOf = (raw) => nipMap.get(String(raw ?? '').trim())?.name ?? null;
const deptOf = (raw) => nipMap.get(String(raw ?? '').trim())?.depart_id ?? null;

const emptyToNull = (value) => {
  const text = value === null || value === undefined ? '' : String(value).trim();
  return text === '' ? null : text;
};

// --- 0. refuse to run twice --------------------------------------------------
// The target tables are UNIQUE-constrained, so a second run would abort halfway
// through and leave a half migrated database. Fail before writing anything.

const TARGETS = [
  'training_ruang_acara', 'training_acara', 'training_peserta_acara', 'training_absensi',
  'training_test_set', 'training_test_session', 'training_question_pg', 'training_question_essay',
  'training_answer_pg', 'training_answer_essay', 'training_feedback', 'training_migration_map',
];

{
  const counts = await query(
    `SELECT ${TARGETS.map((table, index) => `(SELECT COUNT_BIG(*) FROM dbo.${table}) AS c${index}`).join(', ')};`,
  );
  const occupied = TARGETS.filter((table, index) => Number(counts.recordset[0][`c${index}`]) > 0);
  if (occupied.length > 0) {
    console.error('Import dibatalkan. Tabel target sudah berisi data:');
    occupied.forEach((table) => console.error(`  ${table}: ${counts.recordset[0][`c${TARGETS.indexOf(table)}`]}`));
    console.error('Kosongkan dulu secara sengaja bila memang ingin import ulang.');
    await closeDatabase();
    process.exit(1);
  }
}

// --- 1. ruang_acara ---------------------------------------------------------

const ruangId = new Map();
{
  const seen = new Set();
  let ok = 0;
  for (const row of tables.get('ruang_acara') ?? []) {
    const legacyId = Number(row.id);
    const name = emptyToNull(row.nama_ruangan);
    if (!name) {
      reject('ruang_acara', legacyId, 'nama_ruangan kosong');
      continue;
    }
    if (seen.has(name)) {
      reject('ruang_acara', legacyId, `nama duplikat: ${name}`);
      continue;
    }
    seen.add(name);
    ruangId.set(legacyId, await insertReturningId('training_ruang_acara', ['legacy_id', 'nama_ruangan', 'is_active'], [legacyId, name, 1]));
    ok += 1;
  }
  count('training_ruang_acara', ok, rejects.length);
}

// --- 2. acara ---------------------------------------------------------------

const acaraId = new Map();
const acaraDate = new Map();
{
  let ok = 0;
  for (const row of tables.get('acara') ?? []) {
    const legacyId = Number(row.id);
    const tgl = emptyToNull(row.tgl);
    const mulai = emptyToNull(row.waktu_mulai);
    const selesai = emptyToNull(row.waktu_selesai);

    if (!tgl || !mulai || !selesai) {
      reject('acara', legacyId, 'tgl atau waktu kosong');
      continue;
    }
    if (!(selesai > mulai)) {
      reject('acara', legacyId, `waktu_selesai (${selesai}) harus > waktu_mulai (${mulai})`);
      continue;
    }

    const newId = await insertReturningId(
      'training_acara',
      ['legacy_id', 'judul', 'tgl', 'sasaran', 'materi_pokok', 'waktu_mulai', 'waktu_selesai', 'ruang_id', 'status'],
      [
        legacyId,
        emptyToNull(row.judul) ?? `Acara ${legacyId}`,
        tgl,
        emptyToNull(row.sasaran1) ?? '',
        emptyToNull(row.materi_pokok),
        mulai,
        selesai,
        ruangId.get(Number(row.ruangan)) ?? null,
        'closed',
      ],
    );
    acaraId.set(legacyId, newId);
    acaraDate.set(legacyId, tgl);
    ok += 1;
  }
  count('training_acara', ok, rejects.length);
}

// --- 3. peserta_acara -------------------------------------------------------
// (event_id, participant_nip) is UNIQUE, so duplicates are rejected not merged.

const pesertaKeys = new Set();
{
  const seen = new Set();
  let ok = 0;
  let skipped = 0;

  for (const row of tables.get('peserta_acara') ?? []) {
    const legacyId = Number(row.id);
    const eventId = acaraId.get(Number(row.id_acara));
    if (!eventId) {
      reject('peserta_acara', legacyId, `id_acara ${row.id_acara} tidak ada di tabel acara`);
      skipped += 1;
      continue;
    }

    const nip = nipOf(row.nik_peserta);
    if (!nip) {
      reject('peserta_acara', legacyId, 'nik_peserta kosong');
      skipped += 1;
      continue;
    }
    if (seen.has(`${eventId}|${nip}`)) {
      reject('peserta_acara', legacyId, `duplikat (acara ${row.id_acara}, nip ${nip})`);
      skipped += 1;
      continue;
    }
    seen.add(`${eventId}|${nip}`);

    const attendance = { Hadir: 'present', TidakHadir: 'absent' }[String(row.kehadiran ?? '').trim()] ?? 'not_recorded';
    const blast = Number(row.blast) || 0;
    const invitation = blast === 0 ? 'not_sent' : 'sent';

    await insert('training_peserta_acara', [
      'event_id', 'participant_nip', 'participant_name', 'department_code', 'department_name',
      'attendance_status', 'invitation_status', 'legacy_invitation_code', 'legacy_id', 'joined_at',
    ], [
      eventId, nip, nameOf(row.nik_peserta), emptyToNull(row.departemen) ?? deptOf(row.nik_peserta),
      emptyToNull(row.departemen) ? deptOf(row.nik_peserta) : null,
      attendance, invitation, blast, legacyId, `${acaraDate.get(Number(row.id_acara))}T00:00:00`,
    ]);

    pesertaKeys.add(`${eventId}|${nip}`);
    ok += 1;
  }
  count('training_peserta_acara', ok, skipped);
}

// --- 4. absensi_training ----------------------------------------------------
// file_ttd is only an "NIP-IdAcara" label, not a real file path.

{
  const seen = new Set();
  let ok = 0;
  let skipped = 0;

  for (const row of tables.get('absensi_training') ?? []) {
    const legacyId = Number(row.id);
    const eventId = acaraId.get(Number(row.id_acara));
    const nip = nipOf(row.nik_peserta);

    if (!eventId) {
      reject('absensi_training', legacyId, `id_acara ${row.id_acara} tidak ada`);
      skipped += 1;
      continue;
    }
    if (!nip || !pesertaKeys.has(`${eventId}|${nip}`)) {
      reject('absensi_training', legacyId, `tidak ada peserta (acara ${row.id_acara}, nip ${nip})`);
      skipped += 1;
      continue;
    }
    if (seen.has(`${eventId}|${nip}`)) {
      reject('absensi_training', legacyId, `duplikat (acara ${row.id_acara}, nip ${nip})`);
      skipped += 1;
      continue;
    }
    seen.add(`${eventId}|${nip}`);

    await insert('training_absensi', ['event_id', 'participant_nip', 'photo_path', 'captured_at', 'legacy_id'], [
      eventId, nip, String(row.file_ttd ?? '').trim(), `${String(row.tgl).replace(' ', 'T')}.000`, legacyId,
    ]);
    ok += 1;
  }
  count('training_absensi', ok, skipped);
}

// --- 5. test_set from induk_master_soal -------------------------------------

const testSetId = new Map();
const testSetEvent = new Map();
{
  let ok = 0;
  let skipped = 0;

  for (const row of tables.get('induk_master_soal') ?? []) {
    const legacyId = Number(row.id_soal);
    const eventId = acaraId.get(Number(row.id_acara));
    if (!eventId) {
      reject('induk_master_soal', legacyId, `id_acara ${row.id_acara} tidak ada`);
      skipped += 1;
      continue;
    }

    const declared = Number(row.jumlah_soal);
    const questionCount = Number.isFinite(declared) && declared > 0 ? declared : 1;
    const newId = await insertReturningId('training_test_set', [
      'event_id', 'test_type', 'trainer_nip', 'test_date', 'question_count', 'status', 'legacy_id',
    ], [
      eventId,
      emptyToNull(row.jenis) ?? 'mixed',
      nipOf(row.id_trainer),
      emptyToNull(row.tgl),
      questionCount,
      'closed',
      legacyId,
    ]);

    testSetId.set(legacyId, newId);
    testSetEvent.set(legacyId, eventId);
    ok += 1;
  }
  count('training_test_set', ok, skipped);
}

// --- 6. questions -----------------------------------------------------------

const pgQuestionKey = new Map(); // `${testSetId}|${questionNo}` -> question id
{
  const seenNo = new Set();
  let ok = 0;
  let skipped = 0;

  for (const row of tables.get('master_soal') ?? []) {
    const legacyId = Number(row.id);
    const setId = testSetId.get(Number(row.id_induk));
    if (!setId) {
      reject('master_soal', legacyId, `id_induk ${row.id_induk} tidak ada di induk_master_soal`);
      skipped += 1;
      continue;
    }

    const questionNo = Number(row.nomor_soal);
    if (seenNo.has(`${setId}|${questionNo}`)) {
      reject('master_soal', legacyId, `nomor_soal ${questionNo} duplikat dalam paket yang sama`);
      skipped += 1;
      continue;
    }
    seenNo.add(`${setId}|${questionNo}`);

    const newId = await insertReturningId('training_question_pg', [
      'test_set_id', 'question_no', 'question_text', 'option_a', 'option_b', 'option_c', 'option_d',
      'correct_answer', 'image_path', 'point', 'legacy_id',
    ], [
      setId, questionNo, emptyToNull(row.pertanyaan) ?? '',
      emptyToNull(row.A) ?? '', emptyToNull(row.B) ?? '', emptyToNull(row.C) ?? '', emptyToNull(row.D) ?? '',
      String(row.kunci_jawaban ?? '').trim().toUpperCase(), emptyToNull(row.gambar), Number(row.point) || 0, legacyId,
    ]);
    pgQuestionKey.set(`${setId}|${questionNo}`, newId);
    ok += 1;
  }
  count('training_question_pg', ok, skipped);
}

const essayQuestionKey = new Map();
{
  const seenNo = new Set();
  let ok = 0;
  let skipped = 0;

  for (const row of tables.get('essay') ?? []) {
    const legacyId = Number(row.id);
    const setId = testSetId.get(Number(row.id_induk));
    if (!setId) {
      reject('essay', legacyId, `id_induk ${row.id_induk} tidak ada di induk_master_soal`);
      skipped += 1;
      continue;
    }

    const questionNo = Number(row.nomor_soal);
    if (seenNo.has(`${setId}|${questionNo}`)) {
      reject('essay', legacyId, `nomor_soal ${questionNo} duplikat dalam paket yang sama`);
      skipped += 1;
      continue;
    }
    seenNo.add(`${setId}|${questionNo}`);

    const newId = await insertReturningId('training_question_essay', [
      'test_set_id', 'question_no', 'question_text', 'answer_guide', 'image_path', 'legacy_id',
    ], [
      setId, questionNo, emptyToNull(row.pertanyaan) ?? '', emptyToNull(row.jawaban), emptyToNull(row.gambar), legacyId,
    ]);
    essayQuestionKey.set(`${setId}|${questionNo}`, newId);
    ok += 1;
  }
  count('training_question_essay', ok, skipped);
}

// --- 7. answers -------------------------------------------------------------
// The legacy has no test session, so one is derived per (set, participant, phase).
// A session is only legal if that participant is registered for that event.

const sessionId = new Map(); // `${setId}|${nip}|${phase}` -> session id
let sessionsMade = 0;

const ensureSession = async (setId, eventId, nip, phase, submittedAt) => {
  const key = `${setId}|${nip}|${phase}`;
  if (sessionId.has(key)) return sessionId.get(key);
  if (!nip || !pesertaKeys.has(`${eventId}|${nip}`)) {
    sessionId.set(key, null);
    return null;
  }

  const { recordset } = await query(
    `INSERT INTO dbo.training_test_session (event_id, test_set_id, participant_nip, phase, status, submitted_at)
     OUTPUT INSERTED.id
     VALUES (@eventId, @setId, @nip, @phase, 'submitted', @submittedAt);`,
    (request) =>
      request
        .input('eventId', sql.Int, eventId)
        .input('setId', sql.Int, setId)
        .input('nip', sql.NVarChar(50), nip)
        .input('phase', sql.VarChar(4), phase)
        .input('submittedAt', sql.DateTime2(3), submittedAt),
  );

  const id = recordset[0].id;
  sessionId.set(key, id);
  sessionsMade += 1;
  return id;
};

const LEGACY_PHASE = (value) => {
  const text = String(value ?? '').trim().toLowerCase();
  return text === 'post' || text === 'pos' ? 'post' : 'pre';
};

/** The legacy has no timestamps, so the event date is the honest submitted_at. */
const indukById = new Map((tables.get('induk_master_soal') ?? []).map((row) => [Number(row.id_soal), row]));
const submittedAtFor = (indukId) =>
  `${acaraDate.get(Number(indukById.get(Number(indukId))?.id_acara)) ?? '1900-01-01'}T00:00:00`;

{
  let ok = 0;
  let skipped = 0;
  const seen = new Set();

  for (const row of tables.get('jawaban_user') ?? []) {
    const legacyId = Number(row.id_jawaban);
    const setId = testSetId.get(Number(row.id_induk_soal));
    if (!setId) {
      reject('jawaban_user', legacyId, `id_induk_soal ${row.id_induk_soal} tidak ada di induk_master_soal`);
      skipped += 1;
      continue;
    }

    const answer = String(row.jawaban ?? '').trim().toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(answer)) {
      reject('jawaban_user', legacyId, `jawaban '${row.jawaban}' bukan A/B/C/D (belum dijawab)`);
      skipped += 1;
      continue;
    }

    const questionId = pgQuestionKey.get(`${setId}|${Number(row.nomor_soal)}`);
    if (!questionId) {
      reject('jawaban_user', legacyId, `nomor_soal ${row.nomor_soal} tidak ada di paket soal ${row.id_induk_soal}`);
      skipped += 1;
      continue;
    }

    const eventId = testSetEvent.get(Number(row.id_induk_soal));
    const nip = nipOf(row.nik_peserta);
    const phase = LEGACY_PHASE(row.jenis);
    const session = await ensureSession(setId, eventId, nip, phase, submittedAtFor(row.id_induk_soal));

    if (!session) {
      reject('jawaban_user', legacyId, `nip ${nip} tidak terdaftar di acara ${row.id_induk_soal}`);
      skipped += 1;
      continue;
    }
    if (seen.has(`${session}|${questionId}`)) {
      reject('jawaban_user', legacyId, 'jawaban duplikat untuk soal yang sama');
      skipped += 1;
      continue;
    }
    seen.add(`${session}|${questionId}`);

    const key = String(row.kunci_jawaban ?? '').trim().toUpperCase();
    const point = Number(row.point) || 0;
    const isCorrect = key === answer ? 1 : null;

    const answerId = await insertReturningId('training_answer_pg', [
      'session_id', 'test_set_id', 'question_id', 'answer', 'legacy_answer_key', 'legacy_point', 'submitted_at', 'legacy_id',
    ], [session, setId, questionId, answer, key, point, submittedAtFor(row.id_induk_soal), legacyId]);

    await insert('training_answer_grade_pg', ['answer_id', 'score', 'is_correct'], [
      answerId, isCorrect ? point : null, isCorrect,
    ]);
    ok += 1;
  }
  count('training_answer_pg', ok, skipped);
}

{
  let ok = 0;
  let skipped = 0;
  const seen = new Set();

  for (const row of tables.get('essay_jawaban_user') ?? []) {
    const legacyId = Number(row.id_jawaban);
    const setId = testSetId.get(Number(row.id_induk_soal));
    if (!setId) {
      reject('essay_jawaban_user', legacyId, `id_induk_soal ${row.id_induk_soal} tidak ada`);
      skipped += 1;
      continue;
    }

    const questionId = essayQuestionKey.get(`${setId}|${Number(row.nomor_soal)}`);
    if (!questionId) {
      reject('essay_jawaban_user', legacyId, `nomor_soal ${row.nomor_soal} tidak ada di paket ${row.id_induk_soal}`);
      skipped += 1;
      continue;
    }

    const induk = indukById.get(Number(row.id_induk_soal));
    const eventId = testSetEvent.get(Number(row.id_induk_soal));
    const nip = nipOf(row.nik_peserta);
    const session = await ensureSession(setId, eventId, nip, LEGACY_PHASE(row.jenis), submittedAtFor(row.id_induk_soal));

    if (!session) {
      reject('essay_jawaban_user', legacyId, `nip ${nip} tidak terdaftar di acara ${induk?.id_acara}`);
      skipped += 1;
      continue;
    }
    if (seen.has(`${session}|${questionId}`)) {
      reject('essay_jawaban_user', legacyId, 'jawaban duplikat untuk soal yang sama');
      skipped += 1;
      continue;
    }
    seen.add(`${session}|${questionId}`);

    await insert('training_answer_essay', [
      'session_id', 'test_set_id', 'question_id', 'answer_text', 'legacy_result', 'submitted_at', 'legacy_id',
    ], [session, setId, questionId, emptyToNull(row.jawaban) ?? '', emptyToNull(row.nilai), submittedAtFor(row.id_induk_soal), legacyId]);
    ok += 1;
  }
  count('training_answer_essay', ok, skipped);
}
count('training_test_session', sessionsMade, 0);

// --- 8. feedback ------------------------------------------------------------
// One row per aspect so (event, nip, type, aspect) stays unique. The free text
// comment becomes its own row with a NULL score instead of being repeated.

const FEEDBACK_ASPECTS = {
  user_feedback: [
    'Tempat_Pelaksanaan_Training', 'Peralatan_Perlengkapan_Training', 'Konsumsi_Snack',
    'Fasilitas_Kegiatan_Training', 'Iklim_Kerjasama_Suasana', 'Pengendalian_Waktu',
    'Dinamika_Diskusi', 'Pencapaian_Target_Sesuai_Schedule', 'Sikap_Perilaku_Trainer',
    'Penguasaan_Simulasi_Training', 'Kemampuan_Pembahasan_Simulasi',
    'Efektivitas_Pengg_Alat_Bantu_Peraga', 'Antusiasme_dan_Suara', 'Penampilan_Trainer',
  ],
  trainer_feedback: [
    'Sikap_Perilaku_Peserta', 'Keaktifan_Peserta', 'Keterbukaan_Peserta',
    'Partisipasi_Kehadiran_Peserta', 'Pemahaman_Materi_Oleh_Peserta', 'Inisiatif_Peserta',
  ],
};
for (const [sourceTable, aspects] of Object.entries(FEEDBACK_ASPECTS)) {
  const feedbackType = sourceTable === 'user_feedback' ? 'user' : 'trainer';
  // (event_id, participant_nip, feedback_type, aspect_code) is unique, and the
  // legacy has repeated records for the same participant and event.
  const seenAspect = new Set();
  let ok = 0;
  let skipped = 0;

  const writeAspect = async (eventId, nip, aspectCode, score, comment, legacyRef, legacyId) => {
    const key = `${eventId}|${nip}|${feedbackType}|${aspectCode}`;
    if (seenAspect.has(key)) {
      reject(sourceTable, legacyId, `duplikat (acara ${legacyId}, aspect ${aspectCode})`);
      return 0;
    }
    seenAspect.add(key);

    if (comment === undefined) {
      await insert('training_feedback', ['event_id', 'participant_nip', 'feedback_type', 'aspect_code', 'score', 'legacy_id'], [
        eventId, nip, feedbackType, aspectCode, score, legacyRef,
      ]);
    } else {
      await insert('training_feedback', ['event_id', 'participant_nip', 'feedback_type', 'aspect_code', 'score', 'comment', 'legacy_id'], [
        eventId, nip, feedbackType, aspectCode, score, comment, legacyRef,
      ]);
    }
    return 1;
  };

  for (const row of tables.get(sourceTable) ?? []) {
    const legacyId = Number(row.id);
    const eventId = acaraId.get(Number(row.id_acara));
    const nip = nipOf(row.nik_peserta);

    if (!eventId || !nip || !pesertaKeys.has(`${eventId}|${nip}`)) {
      reject(sourceTable, legacyId, `(acara ${row.id_acara}, nip ${nip}) tidak ada di peserta_acara`);
      skipped += 1;
      continue;
    }

    // legacy_id is uniquely indexed, so only the first row of each legacy
    // record can carry it. The other aspect rows keep NULL. submitted_at takes
    // its DEFAULT because the legacy has no timestamp.
    let legacyRef = legacyId;
    let wrote = 0;

    for (const aspect of aspects) {
      const score = Number(row[aspect]);
      if (!Number.isFinite(score) || score < 1 || score > 5) {
        reject(sourceTable, legacyId, `${aspect}='${row[aspect]}' di luar 1-5`);
        continue;
      }
      wrote += await writeAspect(eventId, nip, aspect, score, undefined, legacyRef, legacyId);
      legacyRef = null;
    }

    const comment = emptyToNull(row.komentar);
    if (comment) wrote += await writeAspect(eventId, nip, 'komentar', null, comment, legacyRef, legacyId);

    if (wrote === 0) skipped += 1;
    else ok += 1;
  }
  count('training_feedback', ok, skipped);
}

// --- 9. record what happened -------------------------------------------------

for (const table of ['schedule_creator']) {
  const rows = tables.get(table) ?? [];
  for (const row of rows) reject(table, row.NONIK, 'berisi PASSWORD plaintext, tidak dimigrasikan');
}

for (const entry of rejects) {
  // target_table is NOT NULL, and a rejected row has no target to point at.
  await insert('training_migration_map', ['source_table', 'source_id', 'target_table', 'status', 'error_message'], [
    entry.table, entry.id, '(tidak dimigrasikan)', 'rejected', entry.reasons.join(' | '),
  ]);
}

const totals = await query(`
  SELECT
    (SELECT COUNT_BIG(*) FROM dbo.training_ruang_acara)    AS ruang,
    (SELECT COUNT_BIG(*) FROM dbo.training_acara)          AS acara,
    (SELECT COUNT_BIG(*) FROM dbo.training_peserta_acara)  AS peserta,
    (SELECT COUNT_BIG(*) FROM dbo.training_absensi)        AS absensi,
    (SELECT COUNT_BIG(*) FROM dbo.training_test_set)       AS test_set,
    (SELECT COUNT_BIG(*) FROM dbo.training_test_session)   AS session,
    (SELECT COUNT_BIG(*) FROM dbo.training_question_pg)    AS soal_pg,
    (SELECT COUNT_BIG(*) FROM dbo.training_question_essay) AS soal_essay,
    (SELECT COUNT_BIG(*) FROM dbo.training_answer_pg)      AS jawaban_pg,
    (SELECT COUNT_BIG(*) FROM dbo.training_answer_essay)   AS jawaban_essay,
    (SELECT COUNT_BIG(*) FROM dbo.training_feedback)       AS feedback,
    (SELECT COUNT_BIG(*) FROM dbo.training_migration_map)  AS ditolak;
`);

console.log('\n=== HASIL IMPORT ===');
console.table(Object.entries(stats).map(([table, value]) => ({ table, ...value })));
console.log('\n=== TOTAL DI DB ===');
console.log(totals.recordset[0]);
console.log(`\n=== DITOLAK: ${rejects.length} baris ===`);
const byReason = new Map();
for (const entry of rejects) {
  for (const reason of entry.reasons) {
    const key = `${entry.table} :: ${reason.replace(/\d+/g, 'N')}`;
    byReason.set(key, (byReason.get(key) ?? 0) + 1);
  }
}
for (const [key, total] of [...byReason].sort((a, b) => b[1] - a[1])) console.log(`  ${String(total).padStart(5)}  ${key}`);

await closeDatabase();
