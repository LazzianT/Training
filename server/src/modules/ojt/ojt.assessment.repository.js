import { createHash, randomBytes, randomUUID } from 'node:crypto';
import sql from 'mssql';
import { query } from '../../db/pool.js';

/*
  The OJT assessment chain, keyed on batch_id and peserta_id instead of
  event_id and participant_nip. This is a deliberate duplicate of the training
  chain: an OJT participant has no NIP, and mixing the two would let OJT data
  surface in training reports.
*/

const hash = (value) => createHash('sha256').update(value).digest('hex');

const toDate = (value) => new Date(`${value}T00:00:00Z`);
const toIso = (value) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '').slice(0, 10);

/* ------------------------------------------------------------------ test sets */

export const listTestSets = async (batchId) => {
  const result = await query(
    `SELECT id, test_type, test_date, question_count, status, dipublikasikan_pada
     FROM dbo.training_ojt_test_set WHERE batch_id = @batchId ORDER BY test_type, id;`,
    (request) => request.input('batchId', sql.Int, batchId),
  );
  return result.recordset.map((row) => ({
    id: row.id,
    type: row.test_type,
    date: toIso(row.test_date),
    questionCount: Number(row.question_count),
    status: row.status,
    publishedAt: row.dipublikasikan_pada ? new Date(row.dipublikasikan_pada).toISOString() : null,
  }));
};

export const createTestSet = async (batchId, type, trainerNip, testDate) => {
  const result = await query(
    `INSERT INTO dbo.training_ojt_test_set (batch_id, test_type, trainer_nip, test_date)
     OUTPUT INSERTED.id
     VALUES (@batchId, @type, @trainerNip, @testDate);`,
    (request) =>
      request
        .input('batchId', sql.Int, batchId)
        .input('type', sql.VarChar(20), type)
        .input('trainerNip', sql.NVarChar(50), trainerNip ?? null)
        .input('testDate', sql.Date, toDate(testDate)),
  );
  return Number(result.recordset[0].id);
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

/** Grading happens here so the published test cannot carry a stale count. */
export const publishTestSet = async (testSetId) => {
  const result = await query(`
    UPDATE dbo.training_ojt_test_set
    SET status = 'published',
        question_count =
          (SELECT COUNT(*) FROM dbo.training_ojt_question_pg WHERE test_set_id = @id)
          + (SELECT COUNT(*) FROM dbo.training_ojt_question_essay WHERE test_set_id = @id),
        dipublikasikan_pada = SYSUTCDATETIME()
    WHERE id = @id
      AND EXISTS (SELECT 1 FROM dbo.training_ojt_question_pg WHERE test_set_id = @id
                  UNION ALL SELECT 1 FROM dbo.training_ojt_question_essay WHERE test_set_id = @id);`,
    (request) => request.input('id', sql.Int, testSetId),
  );
  return (result.rowsAffected[0] ?? 0) > 0;
};

/* ------------------------------------------------------------------------ QR */

export const createQr = async (batchId, purpose) => {
  const rawToken = randomBytes(32).toString('base64url');
  await query(
    `INSERT INTO dbo.training_ojt_qr_access (id, batch_id, token_hash, purpose, expires_at, max_uses)
     VALUES (@id, @batchId, @tokenHash, @purpose, DATEADD(day, 30, SYSUTCDATETIME()), 10000);`,
    (request) =>
      request
        .input('id', sql.UniqueIdentifier, randomUUID())
        .input('batchId', sql.Int, batchId)
        .input('tokenHash', sql.Char(64), hash(rawToken))
        .input('purpose', sql.VarChar(30), purpose),
  );
  return rawToken;
};

export const resolveQr = async (token) => {
  const result = await query(
    `SELECT TOP 1 q.id, q.batch_id, q.purpose, b.judul, b.tanggal_mulai, b.tanggal_selesai, b.lokasi, q.expires_at
     FROM dbo.training_ojt_qr_access q
     JOIN dbo.training_ojt_batch b ON b.id = q.batch_id
     WHERE q.token_hash = @tokenHash AND q.revoked_at IS NULL
       AND q.expires_at > SYSUTCDATETIME() AND q.used_count < q.max_uses;`,
    (request) => request.input('tokenHash', sql.Char(64), hash(String(token ?? ''))),
  );
  return result.recordset[0] ?? null;
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

export const submitFeedback = async (batchId, pesertaId, entries) => {
  for (const entry of entries) {
    await query(
      `UPDATE dbo.training_ojt_feedback
       SET score = @score, comment = @comment, dikirim_pada = SYSUTCDATETIME()
       WHERE batch_id = @batchId AND peserta_id = @pesertaId AND aspect_code = @aspect;`,
      (request) =>
        request
          .input('batchId', sql.Int, batchId)
          .input('pesertaId', sql.Int, pesertaId)
          .input('aspect', sql.NVarChar(100), entry.aspect)
          .input('score', sql.Decimal(3, 1), entry.score)
          .input('comment', sql.NVarChar(sql.MAX), entry.comment ?? null),
    );
    const updated = await query(
      `SELECT TOP 1 1 AS ok FROM dbo.training_ojt_feedback
       WHERE batch_id = @batchId AND peserta_id = @pesertaId AND aspect_code = @aspect;`,
      (request) =>
        request
          .input('batchId', sql.Int, batchId)
          .input('pesertaId', sql.Int, pesertaId)
          .input('aspect', sql.NVarChar(100), entry.aspect),
    );
    if (updated.recordset.length === 0) {
      await query(
        `INSERT INTO dbo.training_ojt_feedback (batch_id, peserta_id, aspect_code, score, comment)
         VALUES (@batchId, @pesertaId, @aspect, @score, @comment);`,
        (request) =>
          request
            .input('batchId', sql.Int, batchId)
            .input('pesertaId', sql.Int, pesertaId)
            .input('aspect', sql.NVarChar(100), entry.aspect)
            .input('score', sql.Decimal(3, 1), entry.score)
            .input('comment', sql.NVarChar(sql.MAX), entry.comment ?? null),
      );
    }
  }
};

export const recordAttendance = async (batchId, pesertaId, signatureData) => {
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  const batch = await query(
    `SELECT tanggal_mulai, tanggal_selesai FROM dbo.training_ojt_batch WHERE id = @id;`,
    (request) => request.input('id', sql.Int, batchId),
  );
  const row = batch.recordset[0];
  if (!row || iso < toIso(row.tanggal_mulai) || iso > toIso(row.tanggal_selesai)) return 'OUT_OF_PERIOD';

  const present = await query(
    `SELECT TOP 1 1 AS ok FROM dbo.training_ojt_absensi WHERE peserta_id = @pesertaId AND tanggal = @today;`,
    (request) => request.input('pesertaId', sql.Int, pesertaId).input('today', sql.Date, toDate(iso)),
  );
  if (present.recordset.length > 0) return 'ALREADY_SUBMITTED';

  await query(
    `INSERT INTO dbo.training_ojt_absensi (peserta_id, tanggal, status, catatan, signature_data)
     VALUES (@pesertaId, @today, 'hadir', @note, @signature);`,
    (request) =>
      request
        .input('pesertaId', sql.Int, pesertaId)
        .input('today', sql.Date, toDate(iso))
        .input('note', sql.NVarChar(500), 'Absensi mandiri lewat QR')
        .input('signature', sql.NVarChar(sql.MAX), signatureData ?? null),
  );
  return 'OK';
};

export const getResults = async (batchId) => {
  const [submissions, attendance] = await Promise.all([
    query(`
      SELECT s.phase, p.nama_lengkap, p.kode_peserta, s.status,
             COALESCE(SUM(g.score), 0) AS score, COALESCE(SUM(q.point), 0) AS total_score
      FROM dbo.training_ojt_test_session s
      JOIN dbo.training_ojt_peserta p ON p.id = s.peserta_id
      JOIN dbo.training_ojt_test_set ts ON ts.id = s.test_set_id
      LEFT JOIN dbo.training_ojt_answer_pg a ON a.session_id = s.id
      LEFT JOIN dbo.training_ojt_question_pg q ON q.id = a.question_id
      LEFT JOIN dbo.training_ojt_answer_grade_pg g ON g.answer_id = a.id
      WHERE ts.batch_id = @batchId
      GROUP BY s.phase, p.nama_lengkap, p.kode_peserta, s.status
      ORDER BY s.phase, p.nama_lengkap;`,
      (request) => request.input('batchId', sql.Int, batchId)),
    query(`
      SELECT p.kode_peserta, p.nama_lengkap, COUNT(a.id) AS hari_hadir
      FROM dbo.training_ojt_peserta p
      LEFT JOIN dbo.training_ojt_absensi a ON a.peserta_id = p.id AND a.status = 'hadir'
      WHERE p.batch_id = @batchId AND p.aktif = 1
      GROUP BY p.kode_peserta, p.nama_lengkap ORDER BY p.nama_lengkap;`,
      (request) => request.input('batchId', sql.Int, batchId)),
  ]);

  return {
    submissions: submissions.recordset.map((row) => ({
      phase: row.phase,
      kodePeserta: row.kode_peserta,
      name: row.nama_lengkap,
      status: row.status,
      score: Number(row.score),
      totalScore: Number(row.total_score),
      percentage:
        Number(row.total_score) > 0
          ? Math.round((Number(row.score) / Number(row.total_score)) * 100)
          : null,
    })),
    attendance: attendance.recordset.map((row) => ({
      kodePeserta: row.kode_peserta,
      name: row.nama_lengkap,
      hariHadir: Number(row.hari_hadir),
    })),
  };
};