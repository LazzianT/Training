import { createHash, randomBytes, randomUUID } from 'node:crypto';
import sql from 'mssql';
import { query } from '../../db/pool.js';

export const ensureAssessmentSchema = async () => {
  await query(`
    IF COL_LENGTH('dbo.training_question_pg', 'image_data') IS NULL
      ALTER TABLE dbo.training_question_pg ADD image_data nvarchar(max) NULL;
    IF COL_LENGTH('dbo.training_question_essay', 'image_data') IS NULL
      ALTER TABLE dbo.training_question_essay ADD image_data nvarchar(max) NULL;
    IF EXISTS (
      SELECT 1 FROM sys.check_constraints
      WHERE name = 'CK_training_qr_access_purpose'
        AND parent_object_id = OBJECT_ID('dbo.training_qr_access')
    ) ALTER TABLE dbo.training_qr_access DROP CONSTRAINT CK_training_qr_access_purpose;
    IF NOT EXISTS (
      SELECT 1 FROM sys.check_constraints
      WHERE name = 'CK_training_qr_access_purpose'
        AND parent_object_id = OBJECT_ID('dbo.training_qr_access')
    ) ALTER TABLE dbo.training_qr_access ADD CONSTRAINT CK_training_qr_access_purpose
    CHECK (purpose IN ('assessment', 'pre_test', 'post_test', 'feedback', 'attendance'));
  `);
};

const hash = (value) => createHash('sha256').update(value).digest('hex');

export const createQrAccess = async (eventId, purpose, actorNip) => {
  const rawToken = randomBytes(32).toString('base64url');
  const id = randomUUID();
  await query(`
    INSERT INTO dbo.training_qr_access (id, event_id, token_hash, purpose, expires_at, max_uses)
    VALUES (@id, @eventId, @tokenHash, @purpose, DATEADD(day, 30, SYSUTCDATETIME()), 10000);`,
    (request) => request.input('id', sql.UniqueIdentifier, id)
      .input('eventId', sql.Int, eventId).input('tokenHash', sql.Char(64), hash(rawToken))
      .input('purpose', sql.VarChar(30), purpose),
  );
  return { id, purpose, token: rawToken, createdByNip: actorNip };
};

export const getAssessmentQrReadiness = async (eventId) => {
  const { recordset } = await query(`
    SELECT TOP 1 s.id, s.status,
      (SELECT COUNT(*) FROM dbo.training_question_pg q WHERE q.test_set_id = s.id) AS pg_question_count
    FROM dbo.training_test_set s
    WHERE s.event_id = @eventId AND s.test_type IN ('pg', 'mixed')
    ORDER BY s.id DESC;`,
    (request) => request.input('eventId', sql.Int, eventId),
  );
  const test = recordset[0];
  if (!test) return { ok: false, reason: 'TEST_NOT_CREATED' };
  if (Number(test.pg_question_count) === 0) return { ok: false, reason: 'TEST_NO_QUESTIONS' };
  if (test.status !== 'published') return { ok: false, reason: 'TEST_NOT_PUBLISHED' };
  return { ok: true };
};

export const listQrAccess = async (eventId) => {
  const { recordset } = await query(`
    SELECT id, purpose, expires_at, max_uses, used_count, revoked_at, created_at
    FROM dbo.training_qr_access WHERE event_id = @eventId ORDER BY created_at DESC;`,
    (request) => request.input('eventId', sql.Int, eventId),
  );
  return recordset.map((row) => ({ id: row.id, purpose: row.purpose, expiresAt: row.expires_at, maxUses: row.max_uses, usedCount: row.used_count, revokedAt: row.revoked_at, createdAt: row.created_at }));
};

export const resolveQrAccess = async (token) => {
  const { recordset } = await query(`
    SELECT TOP 1 q.id, q.event_id, q.purpose, a.judul, a.tgl, a.waktu_mulai, a.waktu_selesai,
      r.nama_ruangan, q.expires_at, q.max_uses, q.used_count
    FROM dbo.training_qr_access q
    JOIN dbo.training_acara a ON a.id = q.event_id
    LEFT JOIN dbo.training_ruang_acara r ON r.id = a.ruang_id
    WHERE q.token_hash = @tokenHash AND q.revoked_at IS NULL
      AND q.expires_at > SYSUTCDATETIME() AND q.used_count < q.max_uses;`,
    (request) => request.input('tokenHash', sql.Char(64), hash(token)),
  );
  return recordset[0] ?? null;
};

export const listTestSets = async (eventId) => {
  const { recordset } = await query(`
    SELECT id, test_type, test_date, question_count, status, published_at
    FROM dbo.training_test_set WHERE event_id = @eventId ORDER BY test_type, id;`,
    (request) => request.input('eventId', sql.Int, eventId),
  );
  return recordset.map((row) => ({ id: row.id, type: row.test_type, date: row.test_date, questionCount: row.question_count, status: row.status, publishedAt: row.published_at }));
};

export const createTestSet = async (eventId, type, trainerNip) => {
  const existing = await query(`SELECT TOP 1 id, test_type, status FROM dbo.training_test_set WHERE event_id=@eventId AND test_type=@type ORDER BY id;`, (request) => request.input('eventId', sql.Int, eventId).input('type', sql.VarChar(20), type));
  if (existing.recordset[0]) return { id: existing.recordset[0].id, type: existing.recordset[0].test_type, status: existing.recordset[0].status, existing: true };
  const { recordset } = await query(`
    INSERT INTO dbo.training_test_set (event_id, test_type, trainer_nip, test_date, question_count)
    OUTPUT INSERTED.id, INSERTED.test_type, INSERTED.status
    VALUES (@eventId, @type, @trainerNip, CAST(SYSUTCDATETIME() AS date), 1);`,
    (request) => request.input('eventId', sql.Int, eventId).input('type', sql.VarChar(20), type).input('trainerNip', sql.NVarChar(50), trainerNip),
  );
  return { id: recordset[0].id, type: recordset[0].test_type, status: recordset[0].status };
};

export const deleteEmptyTestSet = async (testSetId) => {
  const { rowsAffected } = await query(`DELETE FROM dbo.training_test_set WHERE id=@id AND status='draft' AND NOT EXISTS (SELECT 1 FROM dbo.training_question_pg WHERE test_set_id=@id) AND NOT EXISTS (SELECT 1 FROM dbo.training_question_essay WHERE test_set_id=@id);`, (request) => request.input('id', sql.Int, testSetId));
  return (rowsAffected?.[0] ?? 0) > 0;
};

export const addMultipleChoiceQuestion = async (testSetId, input) => {
  const { recordset } = await query(`
    INSERT INTO dbo.training_question_pg
      (test_set_id, question_no, question_text, option_a, option_b, option_c, option_d, correct_answer, image_data, point)
    SELECT @testSetId, COALESCE(MAX(question_no), 0) + 1, @questionText, @a, @b, @c, @d, @correct, @imageData, @point
    FROM dbo.training_question_pg WHERE test_set_id = @testSetId;
    UPDATE dbo.training_test_set SET question_count = (SELECT COUNT(*) FROM dbo.training_question_pg WHERE test_set_id = @testSetId) WHERE id = @testSetId;
    SELECT TOP 1 id, question_no FROM dbo.training_question_pg WHERE test_set_id = @testSetId ORDER BY id DESC;`,
    (request) => request.input('testSetId', sql.Int, testSetId).input('questionText', sql.NVarChar(2000), input.text)
      .input('a', sql.NVarChar(1000), input.a).input('b', sql.NVarChar(1000), input.b).input('c', sql.NVarChar(1000), input.c)
      .input('d', sql.NVarChar(1000), input.d).input('correct', sql.Char(1), input.correct)
      .input('imageData', sql.NVarChar(sql.MAX), input.imageData ?? null)
      .input('point', sql.Decimal(8, 2), input.point),
  );
  return recordset[0];
};

export const addEssayQuestion = async (testSetId, input) => {
  const { recordset } = await query(`
    INSERT INTO dbo.training_question_essay
      (test_set_id, question_no, question_text, instructions, answer_guide, image_data, max_point)
    SELECT @testSetId, COALESCE(MAX(question_no), 0) + 1, @questionText, @instructions, @answerGuide, @imageData, @maxPoint
    FROM dbo.training_question_essay WHERE test_set_id=@testSetId;
    UPDATE dbo.training_test_set SET question_count=(
      (SELECT COUNT(*) FROM dbo.training_question_pg WHERE test_set_id=@testSetId) +
      (SELECT COUNT(*) FROM dbo.training_question_essay WHERE test_set_id=@testSetId)
    ) WHERE id=@testSetId;
    SELECT TOP 1 id, question_no FROM dbo.training_question_essay WHERE test_set_id=@testSetId ORDER BY id DESC;`,
    (request) => request.input('testSetId', sql.Int, testSetId)
      .input('questionText', sql.NVarChar(2000), input.text)
      .input('instructions', sql.NVarChar(sql.MAX), input.instructions ?? null)
      .input('answerGuide', sql.NVarChar(sql.MAX), input.answerGuide ?? null)
      .input('imageData', sql.NVarChar(sql.MAX), input.imageData ?? null)
      .input('maxPoint', sql.Decimal(8, 2), input.point ?? null),
  );
  return recordset[0];
};

export const listQuestions = async (testSetId) => {
  const { recordset } = await query(`
    SELECT id, 'pg' AS type, question_no, question_text FROM dbo.training_question_pg WHERE test_set_id=@testSetId
    UNION ALL
    SELECT id, 'essay' AS type, question_no, question_text FROM dbo.training_question_essay WHERE test_set_id=@testSetId
    ORDER BY question_no;`,
    (request) => request.input('testSetId', sql.Int, testSetId),
  );
  return recordset.map((row) => ({ id: row.id, type: row.type, number: row.question_no, text: row.question_text }));
};

export const deleteQuestion = async (testSetId, type, questionId) => {
  const table = type === 'essay' ? 'training_question_essay' : 'training_question_pg';
  const { rowsAffected } = await query(`
    DELETE FROM dbo.${table} WHERE id=@questionId AND test_set_id=@testSetId AND EXISTS (
      SELECT 1 FROM dbo.training_test_set WHERE id=@testSetId AND status='draft'
    );
    UPDATE dbo.training_test_set SET question_count=(
      (SELECT COUNT(*) FROM dbo.training_question_pg WHERE test_set_id=@testSetId) +
      (SELECT COUNT(*) FROM dbo.training_question_essay WHERE test_set_id=@testSetId)
    ) WHERE id=@testSetId;`,
    (request) => request.input('testSetId', sql.Int, testSetId).input('questionId', sql.Int, questionId),
  );
  return (rowsAffected?.[0] ?? 0) > 0;
};

export const getAssessmentResults = async (eventId) => {
  const result = await query(`
    SELECT s.phase, s.participant_nip, LTRIM(RTRIM(h.Name)) AS participant_name, s.status,
      COALESCE(SUM(g.score), 0) AS score, COALESCE(SUM(q.point), 0) AS total_score
    FROM dbo.training_test_session s
    LEFT JOIN dbo.hris_Employee h ON h.NIP=s.participant_nip
    LEFT JOIN dbo.training_answer_pg a ON a.session_id=s.id
    LEFT JOIN dbo.training_question_pg q ON q.id=a.question_id
    LEFT JOIN dbo.training_answer_grade_pg g ON g.answer_id=a.id
    WHERE s.event_id=@eventId
    GROUP BY s.phase, s.participant_nip, h.Name, s.status
    ORDER BY s.phase, participant_name;

    SELECT s.phase, q.question_no, q.question_text,
      COUNT(a.id) AS answered_count,
      SUM(CASE WHEN g.is_correct=0 THEN 1 ELSE 0 END) AS wrong_count
    FROM dbo.training_test_session s
    JOIN dbo.training_answer_pg a ON a.session_id=s.id
    JOIN dbo.training_question_pg q ON q.id=a.question_id
    LEFT JOIN dbo.training_answer_grade_pg g ON g.answer_id=a.id
    WHERE s.event_id=@eventId
    GROUP BY s.phase, q.question_no, q.question_text
    ORDER BY s.phase, q.question_no;`,
    (request) => request.input('eventId', sql.Int, eventId),
  );
  return {
    submissions: result.recordsets[0].map((row) => ({ phase: row.phase, nip: row.participant_nip, name: row.participant_name, status: row.status, score: Number(row.score), totalScore: Number(row.total_score), percentage: row.total_score ? Math.round((Number(row.score) / Number(row.total_score)) * 100) : null })),
    questionStats: result.recordsets[1].map((row) => ({ phase: row.phase, number: row.question_no, text: row.question_text, answered: Number(row.answered_count), wrong: Number(row.wrong_count), wrongPercentage: row.answered_count ? Math.round((Number(row.wrong_count) / Number(row.answered_count)) * 100) : 0 })),
  };
};

export const publishTestSet = async (testSetId) => {
  const { rowsAffected } = await query(`UPDATE dbo.training_test_set SET status='published', question_count=(SELECT COUNT(*) FROM dbo.training_question_pg WHERE test_set_id=@id) + (SELECT COUNT(*) FROM dbo.training_question_essay WHERE test_set_id=@id), published_at=SYSUTCDATETIME() WHERE id=@id AND (EXISTS (SELECT 1 FROM dbo.training_question_pg WHERE test_set_id=@id) OR EXISTS (SELECT 1 FROM dbo.training_question_essay WHERE test_set_id=@id));`, (request) => request.input('id', sql.Int, testSetId));
  return (rowsAffected?.[0] ?? 0) > 0;
};

const publicContext = async (token, nip) => {
  const access = await resolveQrAccess(token);
  if (!access) return null;
  const participant = await query(`
    SELECT TOP 1 participant_nip FROM dbo.training_peserta_acara
    WHERE event_id=@eventId AND (
      LTRIM(RTRIM(participant_nip))=LTRIM(RTRIM(@nip)) OR
      (TRY_CONVERT(bigint, LTRIM(RTRIM(participant_nip))) IS NOT NULL AND TRY_CONVERT(bigint, LTRIM(RTRIM(@nip))) IS NOT NULL AND TRY_CONVERT(bigint, LTRIM(RTRIM(participant_nip)))=TRY_CONVERT(bigint, LTRIM(RTRIM(@nip))))
    );`,
    (request) => request.input('eventId', sql.Int, access.event_id).input('nip', sql.NVarChar(50), nip),
  );
  if (!participant.recordset[0]) return { access, reason: 'PARTICIPANT_NOT_FOUND' };
  const canonicalNip = participant.recordset[0].participant_nip;
  if (access.purpose === 'attendance') {
    const attendance = await query(`SELECT TOP 1 id FROM dbo.training_absensi WHERE event_id=@eventId AND participant_nip=@nip;`, (request) => request.input('eventId', sql.Int, access.event_id).input('nip', sql.NVarChar(50), canonicalNip));
    return attendance.recordset[0] ? { access, reason: 'ALREADY_SUBMITTED' } : { access, participantNip: canonicalNip, testSetId: null };
  }
  if (access.purpose === 'feedback') {
    const feedback = await query(`SELECT TOP 1 id FROM dbo.training_feedback WHERE event_id=@eventId AND participant_nip=@nip;`, (request) => request.input('eventId', sql.Int, access.event_id).input('nip', sql.NVarChar(50), canonicalNip));
    return feedback.recordset[0] ? { access, reason: 'ALREADY_SUBMITTED' } : { access, participantNip: canonicalNip, testSetId: null };
  }
  const tests = await query(`SELECT TOP 1 id FROM dbo.training_test_set WHERE event_id=@eventId AND test_type IN ('pg','mixed') AND status='published' ORDER BY id DESC;`, (request) => request.input('eventId', sql.Int, access.event_id));
  if (!tests.recordset[0]) return { access, reason: 'TEST_NOT_PUBLISHED' };
  const phase = access.purpose === 'pre_test' ? 'pre' : 'post';
  const session = await query(`SELECT TOP 1 id FROM dbo.training_test_session WHERE event_id=@eventId AND test_set_id=@testSetId AND participant_nip=@nip AND phase=@phase AND status IN ('submitted','locked');`, (request) => request.input('eventId', sql.Int, access.event_id).input('testSetId', sql.Int, tests.recordset[0].id).input('nip', sql.NVarChar(50), canonicalNip).input('phase', sql.VarChar(4), phase));
  return session.recordset[0] ? { access, reason: 'ALREADY_SUBMITTED' } : { access, participantNip: canonicalNip, testSetId: tests.recordset[0].id };
};

export const getPublicAssessment = async (token, nip) => {
  const context = await publicContext(token, nip.trim());
  if (!context || context.reason) return context;
  if (context.access.purpose === 'feedback') return { ...context.access, questions: [], sessionId: null };
  const { recordset } = await query(`SELECT id, question_no, question_text, option_a, option_b, option_c, option_d FROM dbo.training_question_pg WHERE test_set_id=@testSetId ORDER BY question_no`, (request) => request.input('testSetId', sql.Int, context.testSetId));
  return { ...context.access, sessionId: null, questions: recordset.map((row) => ({ id: row.id, number: row.question_no, text: row.question_text, options: { A: row.option_a, B: row.option_b, C: row.option_c, D: row.option_d } })) };
};

export const submitPublicAssessment = async (token, nip, answers) => {
  const context = await publicContext(token, nip.trim());
  if (!context || context.reason || context.access.purpose === 'feedback') return context;
  const phase = context.access.purpose === 'pre_test' ? 'pre' : 'post';
  const { recordset } = await query(`
    MERGE dbo.training_test_session AS target
    USING (SELECT @eventId event_id, @testSetId test_set_id, @nip participant_nip, @phase phase) AS source
    ON target.test_set_id=source.test_set_id AND target.participant_nip=source.participant_nip AND target.phase=source.phase
    WHEN MATCHED THEN UPDATE SET status='submitted', submitted_at=SYSUTCDATETIME()
    WHEN NOT MATCHED THEN INSERT (event_id,test_set_id,participant_nip,phase,status,started_at,submitted_at) VALUES (source.event_id,source.test_set_id,source.participant_nip,source.phase,'submitted',SYSUTCDATETIME(),SYSUTCDATETIME())
    OUTPUT INSERTED.id;`, (request) => request.input('eventId', sql.Int, context.access.event_id).input('testSetId', sql.Int, context.testSetId).input('nip', sql.NVarChar(50), nip).input('phase', sql.VarChar(4), phase));
  const sessionId = recordset[0].id;
  for (const answer of answers) {
    await query(`MERGE dbo.training_answer_pg AS target USING (SELECT @sessionId session_id,@testSetId test_set_id,@questionId question_id) s ON target.session_id=s.session_id AND target.question_id=s.question_id WHEN MATCHED THEN UPDATE SET answer=@answer,submitted_at=SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT(session_id,test_set_id,question_id,answer,submitted_at) VALUES(@sessionId,@testSetId,@questionId,@answer,SYSUTCDATETIME());`, (request) => request.input('sessionId', sql.Int, sessionId).input('testSetId', sql.Int, context.testSetId).input('questionId', sql.Int, answer.questionId).input('answer', sql.Char(1), answer.answer));
    await query(`MERGE dbo.training_answer_grade_pg AS target USING (SELECT TOP 1 a.id answer_id, CASE WHEN a.answer=q.correct_answer THEN q.point ELSE 0 END score, CASE WHEN a.answer=q.correct_answer THEN 1 ELSE 0 END is_correct FROM dbo.training_answer_pg a JOIN dbo.training_question_pg q ON q.id=a.question_id WHERE a.session_id=@sessionId AND a.question_id=@questionId) source ON target.answer_id=source.answer_id WHEN MATCHED THEN UPDATE SET score=source.score,is_correct=source.is_correct,graded_at=SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT(answer_id,score,is_correct,graded_at) VALUES(source.answer_id,source.score,source.is_correct,SYSUTCDATETIME());`, (request) => request.input('sessionId', sql.Int, sessionId).input('questionId', sql.Int, answer.questionId));
  }
  return { sessionId };
};

export const submitFeedback = async (token, nip, entries) => {
  const context = await publicContext(token, nip.trim());
  if (!context || context.reason || context.access.purpose !== 'feedback') return context;
  for (const entry of entries) await query(`MERGE dbo.training_feedback AS target USING (SELECT @eventId event_id,@nip participant_nip,'user' feedback_type,@aspect aspect_code) s ON target.event_id=s.event_id AND target.participant_nip=s.participant_nip AND target.feedback_type=s.feedback_type AND target.aspect_code=s.aspect WHEN MATCHED THEN UPDATE SET score=@score,comment=@comment,submitted_at=SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT(event_id,participant_nip,feedback_type,aspect_code,score,comment) VALUES(@eventId,@nip,'user',@aspect,@score,@comment);`, (request) => request.input('eventId', sql.Int, context.access.event_id).input('nip', sql.NVarChar(50), nip).input('aspect', sql.NVarChar(100), entry.aspect).input('score', sql.Decimal(3, 1), entry.score).input('comment', sql.NVarChar(sql.MAX), entry.comment ?? null));
  return { saved: entries.length };
};

export const submitAttendance = async (token, nip, signatureData) => {
  const context = await publicContext(token, nip.trim());
  if (!context || context.reason || context.access.purpose !== 'attendance') return context;
  await query(`INSERT INTO dbo.training_absensi (event_id, participant_nip, photo_path, signature_data, captured_at) VALUES (@eventId, @nip, 'online-signature', @signatureData, SYSUTCDATETIME());`, (request) => request.input('eventId', sql.Int, context.access.event_id).input('nip', sql.NVarChar(50), context.participantNip).input('signatureData', sql.NVarChar(sql.MAX), signatureData));
  return { saved: true };
};
