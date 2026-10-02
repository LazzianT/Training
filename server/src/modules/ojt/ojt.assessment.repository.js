import { createHash, randomBytes, randomUUID } from 'node:crypto';
import sql from 'mssql';
import { query } from '../../db/pool.js';

/*
  The OJT assessment chain, keyed on materi_id and peserta_id instead of
  event_id and participant_nip. This is a deliberate duplicate of the training
  chain: an OJT participant has no NIP, and mixing the two would let OJT data
  surface in training reports.

  Scope moved from the batch to the material. Four materials in one week used to
  share one pre-test, one feedback form and one attendance mark per day, so none
  of them measured any of the four. What stays on the batch is only what is
  genuinely per batch: the participants, and the QR, since the QR is what
  identifies which participant is answering.
*/

const hash = (value) => createHash('sha256').update(value).digest('hex');

const toDate = (value) => new Date(`${value}T00:00:00Z`);
const toIso = (value) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '').slice(0, 10);

/* ------------------------------------------------------------------ test sets */

/**
 * One question bank per material, shared by every batch.
 *
 * The material, not the batch, owns the questions: the same Safety Induction
 * test is written once and reused, exactly as the material catalog itself is.
 * The day it runs and who presents it live on the schedule.
 */
export const ensureTestSet = async (materiId) => {
  const existing = await query(
    `SELECT id, status, question_count, dipublikasikan_pada
     FROM dbo.training_ojt_test_set WHERE materi_id = @materiId;`,
    (request) => request.input('materiId', sql.Int, materiId),
  );
  if (existing.recordset[0]) {
    return { ...mapTestSet(existing.recordset[0]), created: false };
  }

  const created = await query(
    `INSERT INTO dbo.training_ojt_test_set (materi_id)
     OUTPUT INSERTED.id
     VALUES (@materiId);`,
    (request) => request.input('materiId', sql.Int, materiId),
  );
  return {
    id: created.recordset[0].id,
    materiId,
    status: 'draft',
    questionCount: 0,
    publishedAt: null,
    created: true,
  };
};

const mapTestSet = (row) => ({
  id: row.id,
  materiId: row.materi_id,
  status: row.status,
  questionCount: Number(row.question_count),
  publishedAt: row.dipublikasikan_pada ? new Date(row.dipublikasikan_pada).toISOString() : null,
});

export const findTestSet = async (materiId) => {
  const result = await query(
    `SELECT id, materi_id, status, question_count, dipublikasikan_pada
     FROM dbo.training_ojt_test_set WHERE materi_id = @materiId;`,
    (request) => request.input('materiId', sql.Int, materiId),
  );
  return result.recordset[0] ? mapTestSet(result.recordset[0]) : null;
};

/** Resolves the published bank for a material, or null when it has none. */
export const findPublishedTestSet = async (materiId) => {
  const result = await query(
    `SELECT id, materi_id, status, question_count, dipublikasikan_pada
     FROM dbo.training_ojt_test_set WHERE materi_id = @materiId AND status = 'published';`,
    (request) => request.input('materiId', sql.Int, materiId),
  );
  return result.recordset[0] ? mapTestSet(result.recordset[0]) : null;
};

/**
 * Per material readiness, for every material scheduled in a batch.
 *
 * Exists so the screen can say whether a pre-test would open an empty form. That
 * failure was invisible before: a QR could be printed and handed out with no
 * questions behind it and nobody found out until a participant scanned it.
 */
export const getAssessmentSummary = async (batchId) => {
  const result = await query(
    `SELECT j.id AS jadwal_id, j.materi_id, j.tanggal, j.jam_mulai, j.jam_selesai,
            j.pengisi_nip, j.catatan,
            m.kode AS materi_kode, m.nama AS materi_nama, m.urutan,
            ts.id AS test_set_id, ts.status AS test_set_status,
            ts.question_count, ts.dipublikasikan_pada,
            (SELECT COUNT(*) FROM dbo.training_ojt_peserta p WHERE p.batch_id = j.batch_id AND p.aktif = 1) AS peserta_count,
            (SELECT COUNT(*) FROM dbo.training_ojt_test_session s
              WHERE s.test_set_id = ts.id AND s.status = 'locked') AS sesi_terkunci
     FROM dbo.training_ojt_jadwal_materi j
     JOIN dbo.training_ojt_materi m ON m.id = j.materi_id
     LEFT JOIN dbo.training_ojt_test_set ts ON ts.materi_id = m.id
     WHERE j.batch_id = @batchId
     ORDER BY j.tanggal, m.urutan;`,
    (request) => request.input('batchId', sql.Int, batchId),
  );

  return result.recordset.map((row) => ({
    jadwalId: row.jadwal_id,
    materiId: row.materi_id,
    materiKode: row.materi_kode,
    materiNama: row.materi_nama,
    tanggal: toIso(row.tanggal),
    jamMulai: row.jam_mulai ? String(row.jam_mulai).slice(0, 5) : null,
    jamSelesai: row.jam_selesai ? String(row.jam_selesai).slice(0, 5) : null,
    pengisiNip: row.pengisi_nip ?? null,
    catatan: row.catatan ?? null,
    pesertaCount: Number(row.peserta_count),
    testSetId: row.test_set_id ?? null,
    testSetStatus: row.test_set_status ?? null,
    questionCount: Number(row.question_count ?? 0),
    publishedAt: row.dipublikasikan_pada ? new Date(row.dipublikasikan_pada).toISOString() : null,
    sesiTerkunci: Number(row.sesi_terkunci ?? 0),
    /**
     The one thing the screen must not let happen quietly: handing out a pre-test
     QR that resolves to nothing.
     */
    siapUntukUji:
      row.test_set_status === 'published' && Number(row.question_count ?? 0) > 0,
  }));
};

export const addQuestion = async (testSetId, input) => {
  if (input.type === 'essay') {
    const next = await query(
      `SELECT ISNULL(MAX(question_no), 0) + 1 AS next_no FROM dbo.training_ojt_question_essay WHERE test_set_id = @id;`,
      (request) => request.input('id', sql.Int, testSetId),
    );
    await query(
      `INSERT INTO dbo.training_ojt_question_essay
         (test_set_id, question_no, question_text, instructions, answer_guide, image_data, max_point)
       VALUES (@setId, @no, @text, @instructions, @guide, @image, @point);`,
      (request) =>
        request
          .input('setId', sql.Int, testSetId)
          .input('no', sql.Int, Number(next.recordset[0].next_no))
          .input('text', sql.NVarChar(2000), input.text)
          .input('instructions', sql.NVarChar(sql.MAX), input.instructions ?? null)
          .input('guide', sql.NVarChar(sql.MAX), input.answerGuide ?? null)
          .input('image', sql.NVarChar(sql.MAX), input.imageData ?? null)
          .input('point', sql.Decimal(8, 2), input.point ?? 1),
    );
    return;
  }

  const next = await query(
    `SELECT ISNULL(MAX(question_no), 0) + 1 AS next_no FROM dbo.training_ojt_question_pg WHERE test_set_id = @id;`,
    (request) => request.input('id', sql.Int, testSetId),
  );
  await query(
    `INSERT INTO dbo.training_ojt_question_pg
       (test_set_id, question_no, question_text, option_a, option_b, option_c, option_d, correct_answer, image_data, point)
     VALUES (@setId, @no, @text, @a, @b, @c, @d, @correct, @image, @point);`,
    (request) =>
      request
        .input('setId', sql.Int, testSetId)
        .input('no', sql.Int, Number(next.recordset[0].next_no))
        .input('text', sql.NVarChar(2000), input.text)
        .input('a', sql.NVarChar(1000), input.a)
        .input('b', sql.NVarChar(1000), input.b)
        .input('c', sql.NVarChar(1000), input.c)
        .input('d', sql.NVarChar(1000), input.d)
        .input('correct', sql.Char(1), input.correct)
        .input('image', sql.NVarChar(sql.MAX), input.imageData ?? null)
        .input('point', sql.Decimal(8, 2), input.point ?? 1),
  );
};

export const listQuestions = async (testSetId) => {
  const result = await query(`
    SELECT 'pg' AS type, id, question_no, question_text FROM dbo.training_ojt_question_pg WHERE test_set_id = @id
    UNION ALL
    SELECT 'essay' AS type, id, question_no, question_text FROM dbo.training_ojt_question_essay WHERE test_set_id = @id
    ORDER BY question_no;`,
    (request) => request.input('id', sql.Int, testSetId),
  );
  return result.recordset.map((row) => ({
    id: row.id,
    type: row.type,
    number: Number(row.question_no),
    text: row.question_text,
  }));
};

export const deleteQuestion = async (testSetId, questionId) => {
  const pg = await query(
    `DELETE FROM dbo.training_ojt_question_pg WHERE test_set_id = @setId AND id = @id;`,
    (request) => request.input('setId', sql.Int, testSetId).input('id', sql.Int, questionId),
  );
  if ((pg.rowsAffected[0] ?? 0) > 0) return true;
  const essay = await query(
    `DELETE FROM dbo.training_ojt_question_essay WHERE test_set_id = @setId AND id = @id;`,
    (request) => request.input('setId', sql.Int, testSetId).input('id', sql.Int, questionId),
  );
  return (essay.rowsAffected[0] ?? 0) > 0;
};

/**
 * Locks the question count in at publish time.
 *
 * A published bank that could still gain questions would let a participant who
 * already answered be scored against a different paper than the one they saw.
 */
export const publishTestSet = async (testSetId) => {
  const result = await query(`
    UPDATE dbo.training_ojt_test_set
    SET status = 'published',
        question_count =
          (SELECT COUNT(*) FROM dbo.training_ojt_question_pg WHERE test_set_id = @id)
          + (SELECT COUNT(*) FROM dbo.training_ojt_question_essay WHERE test_set_id = @id),
        dipublikasikan_pada = SYSUTCDATETIME()
    WHERE id = @id AND status = 'draft'
      AND EXISTS (SELECT 1 FROM dbo.training_ojt_question_pg WHERE test_set_id = @id
                  UNION ALL SELECT 1 FROM dbo.training_ojt_question_essay WHERE test_set_id = @id);`,
    (request) => request.input('id', sql.Int, testSetId),
  );
  return (result.rowsAffected[0] ?? 0) > 0;
};

/** Back to draft so a corrected question can be added. Answers already taken are
 *  untouched: the locked session keeps its own graded rows. */
export const unpublishTestSet = async (testSetId) => {
  const result = await query(
    `UPDATE dbo.training_ojt_test_set SET status = 'draft', dipublikasikan_pada = NULL WHERE id = @id;`,
    (request) => request.input('id', sql.Int, testSetId),
  );
  return (result.rowsAffected[0] ?? 0) > 0;
};

/* ------------------------------------------------------------------------ QR */

/**
 * Issues a QR for one material of one batch, revoking the previous one for that
 * same combination.
 *
 * Previously every click minted another code valid for thirty days, so a batch
 * ended up with a drawer of codes that all still worked and no way to tell which
 * was the current one. Revoking on issue leaves exactly one live code per
 * material and purpose, which is the only one anyone should be holding.
 */
export const createQr = async (batchId, materiId, purpose) => {
  const rawToken = randomBytes(32).toString('base64url');
  await query(
    `UPDATE dbo.training_ojt_qr_access
     SET revoked_at = SYSUTCDATETIME()
     WHERE batch_id = @batchId AND materi_id = @materiId AND purpose = @purpose
       AND revoked_at IS NULL;`,
    (request) =>
      request
        .input('batchId', sql.Int, batchId)
        .input('materiId', sql.Int, materiId)
        .input('purpose', sql.VarChar(30), purpose),
  );
  await query(
    `INSERT INTO dbo.training_ojt_qr_access (id, batch_id, materi_id, token_hash, purpose, expires_at, max_uses)
     VALUES (@id, @batchId, @materiId, @tokenHash, @purpose, DATEADD(day, 30, SYSUTCDATETIME()), 10000);`,
    (request) =>
      request
        .input('id', sql.UniqueIdentifier, randomUUID())
        .input('batchId', sql.Int, batchId)
        .input('materiId', sql.Int, materiId)
        .input('tokenHash', sql.Char(64), hash(rawToken))
        .input('purpose', sql.VarChar(30), purpose),
  );
  return rawToken;
};

/**
 * Resolves a participant-facing code.
 *
 * Joins the material and its scheduled date so the participant page can say what
 * they are being assessed on, and so attendance can be recorded against the day
 * the material actually runs rather than the day the phone was scanned.
 */
export const resolveQr = async (token) => {
  const result = await query(
    `SELECT TOP 1 q.id, q.batch_id, q.materi_id, q.purpose, q.expires_at,
            b.judul, b.tanggal_mulai, b.tanggal_selesai, b.lokasi,
            m.kode AS materi_kode, m.nama AS materi_nama,
            j.tanggal AS materi_tanggal
     FROM dbo.training_ojt_qr_access q
     JOIN dbo.training_ojt_batch b ON b.id = q.batch_id
     JOIN dbo.training_ojt_materi m ON m.id = q.materi_id
     LEFT JOIN dbo.training_ojt_jadwal_materi j ON j.batch_id = q.batch_id AND j.materi_id = q.materi_id
     WHERE q.token_hash = @tokenHash AND q.revoked_at IS NULL
       AND q.expires_at > SYSUTCDATETIME() AND q.used_count < q.max_uses;`,
    (request) => request.input('tokenHash', sql.Char(64), hash(String(token ?? ''))),
  );
  const row = result.recordset[0];
  if (!row) return null;
  return {
    ...row,
    materi_kode: row.materi_kode,
    materi_nama: row.materi_nama,
    materi_tanggal: row.materi_tanggal ? toIso(row.materi_tanggal) : null,
  };
};

/**
 * Participants of the batch, for the name picker on the participant form.
 *
 * Only the name and the code. No department, no position, no assessment history:
 * this is the one list a QR holder can read without an account, so it carries the
 * minimum that makes picking a name possible.
 *
 * The picker exists because a code is something a participant has to have kept.
 * HR hands out a code once, at induction, and by the day of the material it has
 * been lost, which turns a two minute form into a trip to the HR desk.
 */
export const listBatchPeserta = async (batchId) => {
  const result = await query(
    `SELECT kode_peserta, nama_lengkap
     FROM dbo.training_ojt_peserta
     WHERE batch_id = @batchId AND aktif = 1
     ORDER BY nama_lengkap, kode_peserta;`,
    (request) => request.input('batchId', sql.Int, batchId),
  );
  return result.recordset.map((row) => ({
    kodePeserta: row.kode_peserta,
    namaLengkap: row.nama_lengkap,
  }));
};

/**
 * The participant identifies themselves with the HR code, matched inside the
 * batch the QR belongs to. Trim-only, no numeric coercion: OJT codes are not
 * numbers and a numeric branch here would silently equate two people.
 */
export const findPeserta = async (batchId, kode) => {
  const result = await query(
    `SELECT TOP 1 id, kode_peserta, nama_lengkap, departemen
     FROM dbo.training_ojt_peserta
     WHERE batch_id = @batchId AND aktif = 1 AND LTRIM(RTRIM(kode_peserta)) = LTRIM(RTRIM(@kode));`,
    (request) => request.input('batchId', sql.Int, batchId).input('kode', sql.NVarChar(50), kode),
  );
  return result.recordset[0] ?? null;
};

export const bumpQrUse = async (qrId) => {
  await query(
    `UPDATE dbo.training_ojt_qr_access SET used_count = used_count + 1 WHERE id = @id;`,
    (request) => request.input('id', sql.UniqueIdentifier, qrId),
  );
};

/**
 * Returns the session for this participant and phase, creating it if absent.
 * A submitted session is returned untouched so a participant cannot retake a
 * locked test by rescanning the QR.
 *
 * The material comes in through test_set_id, so this is already per material and
 * the key did not have to change.
 */
export const getOrCreateSession = async (testSetId, pesertaId, phase) => {
  const existing = await query(
    `SELECT id, status, dimulai_pada, dikirim_pada FROM dbo.training_ojt_test_session
     WHERE test_set_id = @setId AND peserta_id = @pesertaId AND phase = @phase;`,
    (request) =>
      request
        .input('setId', sql.Int, testSetId)
        .input('pesertaId', sql.Int, pesertaId)
        .input('phase', sql.VarChar(4), phase),
  );
  if (existing.recordset[0]) return existing.recordset[0];

  const created = await query(
    `INSERT INTO dbo.training_ojt_test_session (test_set_id, peserta_id, phase, status, dimulai_pada)
     OUTPUT INSERTED.id
     VALUES (@setId, @pesertaId, @phase, 'in_progress', SYSUTCDATETIME());`,
    (request) =>
      request
        .input('setId', sql.Int, testSetId)
        .input('pesertaId', sql.Int, pesertaId)
        .input('phase', sql.VarChar(4), phase),
  );
  return { id: created.recordset[0].id, status: 'in_progress', dikirim_pada: null };
};

/** Ownership check: a session id from the client must still belong to the
 *  participant whose HR code was presented. */
export const getSession = async (sessionId) => {
  const result = await query(
    `SELECT id, test_set_id, peserta_id, phase, status FROM dbo.training_ojt_test_session WHERE id = @id;`,
    (request) => request.input('id', sql.Int, sessionId),
  );
  return result.recordset[0] ?? null;
};

export const loadAssessment = async (testSetId) => {
  const result = await query(`
    SELECT id, question_no, question_text, option_a, option_b, option_c, option_d, image_data
    FROM dbo.training_ojt_question_pg WHERE test_set_id = @id ORDER BY question_no;`,
    (request) => request.input('id', sql.Int, testSetId),
  );
  return result.recordset.map((row) => ({
    id: row.id,
    number: Number(row.question_no),
    text: row.question_text,
    image: row.image_data ?? null,
    options: {
      A: row.option_a,
      B: row.option_b,
      C: row.option_c,
      D: row.option_d,
    },
  }));
};

/** Grades and stores each multiple-choice answer in the same transaction that
 *  closes the session, so a participant can never see a score for a partial save. */
export const submitAnswers = async (sessionId, testSetId, answers) => {
  const keys = await query(
    `SELECT id, correct_answer, point FROM dbo.training_ojt_question_pg WHERE test_set_id = @id;`,
    (request) => request.input('id', sql.Int, testSetId),
  );
  const byId = new Map(keys.recordset.map((row) => [row.id, row]));

  for (const answer of answers) {
    const question = byId.get(answer.questionId);
    if (!question) continue;
    const correct = question.correct_answer === answer.answer;
    const score = correct ? Number(question.point) : 0;

    await query(
      `DELETE FROM dbo.training_ojt_answer_pg WHERE session_id = @sessionId AND question_id = @questionId;`,
      (request) => request.input('sessionId', sql.Int, sessionId).input('questionId', sql.Int, answer.questionId),
    );
    await query(
      `INSERT INTO dbo.training_ojt_answer_pg (session_id, question_id, answer)
       OUTPUT INSERTED.id
       VALUES (@sessionId, @questionId, @answer);`,
      (request) =>
        request
          .input('sessionId', sql.Int, sessionId)
          .input('questionId', sql.Int, answer.questionId)
          .input('answer', sql.Char(1), answer.answer),
    );
    const saved = await query(
      `SELECT TOP 1 id FROM dbo.training_ojt_answer_pg WHERE session_id = @sessionId AND question_id = @questionId;`,
      (request) => request.input('sessionId', sql.Int, sessionId).input('questionId', sql.Int, answer.questionId),
    );
    await query(
      `INSERT INTO dbo.training_ojt_answer_grade_pg (answer_id, is_correct, score)
       VALUES (@answerId, @correct, @score);`,
      (request) =>
        request
          .input('answerId', sql.Int, saved.recordset[0].id)
          .input('correct', sql.Bit, correct)
          .input('score', sql.Decimal(8, 2), score),
    );
  }

  await query(
    `UPDATE dbo.training_ojt_test_session
     SET status = 'locked', dikirim_pada = SYSUTCDATETIME(), dikunci_pada = SYSUTCDATETIME()
     WHERE id = @id;`,
    (request) => request.input('id', sql.Int, sessionId),
  );
};

export const submitFeedback = async (batchId, materiId, pesertaId, entries) => {
  for (const entry of entries) {
    const updated = await query(
      `UPDATE dbo.training_ojt_feedback
       SET score = @score, comment = @comment, dikirim_pada = SYSUTCDATETIME()
       WHERE batch_id = @batchId AND materi_id = @materiId AND peserta_id = @pesertaId AND aspect_code = @aspect;`,
      (request) =>
        request
          .input('batchId', sql.Int, batchId)
          .input('materiId', sql.Int, materiId)
          .input('pesertaId', sql.Int, pesertaId)
          .input('aspect', sql.NVarChar(100), entry.aspect)
          .input('score', sql.Decimal(3, 1), entry.score)
          .input('comment', sql.NVarChar(sql.MAX), entry.comment ?? null),
    );
    if ((updated.rowsAffected[0] ?? 0) === 0) {
      await query(
        `INSERT INTO dbo.training_ojt_feedback (batch_id, materi_id, peserta_id, aspect_code, score, comment)
         VALUES (@batchId, @materiId, @pesertaId, @aspect, @score, @comment);`,
        (request) =>
          request
            .input('batchId', sql.Int, batchId)
            .input('materiId', sql.Int, materiId)
            .input('pesertaId', sql.Int, pesertaId)
            .input('aspect', sql.NVarChar(100), entry.aspect)
            .input('score', sql.Decimal(3, 1), entry.score)
            .input('comment', sql.NVarChar(sql.MAX), entry.comment ?? null),
      );
    }
  }
};

/**
 * Records presence for one material of one batch.
 *
 * The row is written against the material's scheduled date, not the date of the
 * scan. One material runs on one day, so that date is already known, and keying
 * on it means a late scan still lands on the right day instead of on whichever day
 * the phone happened to be used. It also makes a rescan idempotent.
 */
export const recordAttendance = async (batchId, materiId, pesertaId, signatureData) => {
  const schedule = await query(
    `SELECT j.tanggal, b.tanggal_mulai, b.tanggal_selesai, b.judul, m.nama AS materi_nama
     FROM dbo.training_ojt_jadwal_materi j
     JOIN dbo.training_ojt_batch b ON b.id = j.batch_id
     JOIN dbo.training_ojt_materi m ON m.id = j.materi_id
     WHERE j.batch_id = @batchId AND j.materi_id = @materiId;`,
    (request) => request.input('batchId', sql.Int, batchId).input('materiId', sql.Int, materiId),
  );
  const row = schedule.recordset[0];
  if (!row) return 'MATERIAL_NOT_SCHEDULED';

  const tanggal = toIso(row.tanggal);
  if (tanggal < toIso(row.tanggal_mulai) || tanggal > toIso(row.tanggal_selesai)) return 'OUT_OF_PERIOD';

  const present = await query(
    `SELECT TOP 1 1 AS ok FROM dbo.training_ojt_absensi
     WHERE peserta_id = @pesertaId AND materi_id = @materiId AND tanggal = @tanggal;`,
    (request) =>
      request
        .input('pesertaId', sql.Int, pesertaId)
        .input('materiId', sql.Int, materiId)
        .input('tanggal', sql.Date, toDate(tanggal)),
  );
  if (present.recordset.length > 0) return 'ALREADY_SUBMITTED';

  await query(
    `INSERT INTO dbo.training_ojt_absensi (peserta_id, materi_id, tanggal, status, catatan, signature_data)
     VALUES (@pesertaId, @materiId, @tanggal, 'hadir', @note, @signature);`,
    (request) =>
      request
        .input('pesertaId', sql.Int, pesertaId)
        .input('materiId', sql.Int, materiId)
        .input('tanggal', sql.Date, toDate(tanggal))
        .input('note', sql.NVarChar(500), 'Absensi mandiri lewat QR')
        .input('signature', sql.NVarChar(sql.MAX), signatureData ?? null),
  );
  return 'OK';
};

/**
 * Scores for every participant against every material the batch teaches.
 *
 * Built from the roster outward rather than from the sessions inward, which is
 * the whole point: a session row only exists once somebody starts, so listing
 * sessions can only ever show who has worked and never who has not. The question
 * HR actually asks is about the people who have not.
 *
 * The three states are distinct on purpose. No session at all is "belum
 * mengerjakan". A session that exists but is not locked is "sedang mengerjakan",
 * and showing that as a blank would read as not started and send someone chasing
 * a participant who is halfway through. Locked with nothing gradeable, which is
 * what an essay-only bank produces, is its own case rather than a score of zero:
 * zero is a result, and reporting it for an unanswered paper would be wrong.
 */
export const getResults = async (batchId) => {
  const [peserta, jadwal, sessions, attendanceRows, perPeserta, perMateri] = await Promise.all([
    query(
      `SELECT id, kode_peserta, nama_lengkap FROM dbo.training_ojt_peserta
       WHERE batch_id = @batchId AND aktif = 1 ORDER BY nama_lengkap, kode_peserta;`,
      (request) => request.input('batchId', sql.Int, batchId),
    ),
    query(
      `SELECT j.materi_id, j.tanggal, m.kode AS materi_kode, m.nama AS materi_nama, m.urutan
       FROM dbo.training_ojt_jadwal_materi j
       JOIN dbo.training_ojt_materi m ON m.id = j.materi_id
       WHERE j.batch_id = @batchId
       ORDER BY j.tanggal, m.urutan;`,
      (request) => request.input('batchId', sql.Int, batchId),
    ),
    query(
      `SELECT s.peserta_id, ts.materi_id, s.phase, s.status,
              COALESCE(SUM(g.score), 0) AS score, COALESCE(SUM(q.point), 0) AS total_score
       FROM dbo.training_ojt_test_session s
       JOIN dbo.training_ojt_test_set ts ON ts.id = s.test_set_id
       LEFT JOIN dbo.training_ojt_answer_pg a ON a.session_id = s.id
       LEFT JOIN dbo.training_ojt_question_pg q ON q.id = a.question_id
       LEFT JOIN dbo.training_ojt_answer_grade_pg g ON g.answer_id = a.id
       WHERE s.peserta_id IN (SELECT id FROM dbo.training_ojt_peserta WHERE batch_id = @batchId AND aktif = 1)
       GROUP BY s.peserta_id, ts.materi_id, s.phase, s.status;`,
      (request) => request.input('batchId', sql.Int, batchId)),
    query(
      `SELECT a.materi_id, a.peserta_id, a.status
       FROM dbo.training_ojt_absensi a
       JOIN dbo.training_ojt_peserta p ON p.id = a.peserta_id
       WHERE p.batch_id = @batchId AND p.aktif = 1;`,
      (request) => request.input('batchId', sql.Int, batchId)),
    query(
      `SELECT p.kode_peserta, p.nama_lengkap,
              COUNT(a.id) AS materi_hadir,
              COUNT(DISTINCT a.tanggal) AS hari_hadir
       FROM dbo.training_ojt_peserta p
       LEFT JOIN dbo.training_ojt_absensi a ON a.peserta_id = p.id AND a.status = 'hadir'
       WHERE p.batch_id = @batchId AND p.aktif = 1
       GROUP BY p.kode_peserta, p.nama_lengkap ORDER BY p.nama_lengkap;`,
      (request) => request.input('batchId', sql.Int, batchId)),
    query(
      `SELECT m.id AS materi_id, m.kode AS materi_kode, m.nama AS materi_nama, m.urutan, j.tanggal, COUNT(a.id) AS hadir
       FROM dbo.training_ojt_jadwal_materi j
       JOIN dbo.training_ojt_materi m ON m.id = j.materi_id
       LEFT JOIN dbo.training_ojt_absensi a ON a.materi_id = m.id AND a.tanggal = j.tanggal AND a.status = 'hadir'
       WHERE j.batch_id = @batchId
       GROUP BY m.id, m.kode, m.nama, m.urutan, j.tanggal ORDER BY j.tanggal, m.urutan;`,
      (request) => request.input('batchId', sql.Int, batchId)),
  ]);

  const byKey = new Map();
  for (const row of sessions.recordset) {
    byKey.set(`${row.peserta_id}|${row.materi_id}|${row.phase}`, row);
  }

  const cell = (pesertaId, materiId, phase) => {
    const row = byKey.get(`${pesertaId}|${materiId}|${phase}`);
    if (!row) return { state: 'belum', score: null, totalScore: null, percentage: null };
    if (row.status !== 'locked') {
      return { state: 'mengerjakan', score: null, totalScore: null, percentage: null };
    }
    const score = Number(row.score);
    const totalScore = Number(row.total_score);
    if (totalScore === 0) {
      // Locked, but nothing was gradeable: an essay-only bank. Not a zero.
      return { state: 'tanpa_nilai', score: null, totalScore: null, percentage: null };
    }
    return {
      state: 'selesai',
      score,
      totalScore,
      percentage: Math.round((score / totalScore) * 100),
    };
  };

  /*
    Attendance is looked up per (material, participant) rather than only counted,
    because a bare "3 of 4" is a number nobody can act on. Who is missing is the
    question, and it is the same reasoning that made the score grid start from the
    roster instead of the sessions.
  */
  const attended = new Set(
    attendanceRows.recordset
      .filter((row) => row.status === 'hadir')
      .map((row) => `${row.materi_id}|${row.peserta_id}`),
  );

  return {
    byMateri: jadwal.recordset.map((materi) => ({
      materiId: materi.materi_id,
      materiKode: materi.materi_kode,
      materiNama: materi.materi_nama,
      tanggal: toIso(materi.tanggal),
      peserta: peserta.recordset.map((person) => ({
        kodePeserta: person.kode_peserta,
        namaLengkap: person.nama_lengkap,
        pre: cell(person.id, materi.materi_id, 'pre'),
        post: cell(person.id, materi.materi_id, 'post'),
      })),
    })),
    attendance: perPeserta.recordset.map((row) => ({
      kodePeserta: row.kode_peserta,
      name: row.nama_lengkap,
      /* Materials attended, not days: attendance is now recorded per material. */
      materiHadir: Number(row.materi_hadir),
      hariHadir: Number(row.hari_hadir),
    })),
    attendanceByMateri: perMateri.recordset.map((row) => ({
      materiId: row.materi_id,
      materiKode: row.materi_kode,
      materiNama: row.materi_nama,
      tanggal: toIso(row.tanggal),
      hadir: Number(row.hadir),
      /**
       * Every participant, so the row can be opened into a list of who came and
       * who did not. `hadir` stays as the count the closed row shows.
       */
      peserta: peserta.recordset.map((person) => ({
        kodePeserta: person.kode_peserta,
        namaLengkap: person.nama_lengkap,
        hadir: attended.has(`${row.materi_id}|${person.id}`),
      })),
    })),
  };
};