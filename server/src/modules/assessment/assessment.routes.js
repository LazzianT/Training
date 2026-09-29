import { Router } from 'express';
import { z } from 'zod';
import sql from 'mssql';
import { authenticate } from '../../middleware/authenticate.js';
import { query } from '../../db/pool.js';
import { addEssayQuestion, addMultipleChoiceQuestion, createQrAccess, createTestSet, deleteEmptyTestSet, deleteQuestion, getAssessmentQrReadiness, getAssessmentResults, getPublicAssessment, listQuestions, listQrAccess, listTestSets, publishTestSet, resolveQrAccess, submitAttendance, submitFeedback, submitPublicAssessment } from './assessment.repository.js';
import { getEvent } from '../event/event.repository.js';

const purpose = z.enum(['pre_test', 'post_test', 'feedback', 'attendance']);
const idSchema = z.coerce.number().int().positive();
const testType = z.enum(['pg', 'essay', 'mixed']);
const questionBody = z.object({ type: z.enum(['pg', 'essay']), text: z.string().trim().min(1).max(2000), a: z.string().trim().max(1000).optional(), b: z.string().trim().max(1000).optional(), c: z.string().trim().max(1000).optional(), d: z.string().trim().max(1000).optional(), correct: z.enum(['A', 'B', 'C', 'D']).optional(), instructions: z.string().max(5000).optional().nullable(), answerGuide: z.string().max(10000).optional().nullable(), imageData: z.string().max(8_000_000).optional().nullable(), point: z.coerce.number().positive().max(1000).default(1) }).superRefine((value, context) => { if (value.type === 'pg' && (!value.a || !value.b || !value.c || !value.d || !value.correct)) context.addIssue({ code: 'custom', message: 'Pilihan dan kunci jawaban PG wajib diisi.' }); });
const questionType = z.enum(['pg', 'essay']);
const publicIdentity = z.object({ nip: z.string().trim().min(1).max(50) });
const answersBody = z.object({ nip: z.string().trim().min(1).max(50), answers: z.array(z.object({ questionId: z.coerce.number().int().positive(), answer: z.enum(['A', 'B', 'C', 'D']) })).max(500) });
const feedbackBody = z.object({ nip: z.string().trim().min(1).max(50), entries: z.array(z.object({ aspect: z.string().trim().min(1).max(100), score: z.coerce.number().min(1).max(5), comment: z.string().max(5000).optional().nullable() })).min(1).max(50) });
const attendanceBody = z.object({ nip: z.string().trim().min(1).max(50), signatureData: z.string().regex(/^data:image\/(png|jpeg);base64,/, 'Tanda tangan tidak valid.').max(2_000_000) });

export const assessmentRouter = Router();

assessmentRouter.get('/access/:token', async (request, response, next) => {
  try {
    const access = await resolveQrAccess(request.params.token);
    if (!access) return response.status(404).json({ error: { code: 'QR_EXPIRED', message: 'QR tidak berlaku.' } });
    response.json({ eventId: access.event_id, purpose: access.purpose, title: access.judul, date: access.tgl, room: access.nama_ruangan, expiresAt: access.expires_at });
  } catch (error) {
    if (error?.number === 547 || error?.number === 2601 || error?.number === 2627) {
      return response.status(409).json({ error: { code: 'PUBLISH_FAILED', message: 'Test belum dapat dipublikasikan. Pastikan test memiliki soal dan struktur database assessment sudah diperbarui.' } });
    }
    next(error);
  }
});

assessmentRouter.post('/access/:token/open', async (request, response, next) => {
  const identity = publicIdentity.safeParse(request.body);
  if (!identity.success) return response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'NIP tidak valid.' } });
  try {
    const assessment = await getPublicAssessment(request.params.token, identity.data.nip);
    if (!assessment || assessment.reason === 'PARTICIPANT_NOT_FOUND') return response.status(403).json({ error: { code: 'PARTICIPANT_NOT_FOUND', message: 'NIP  tidak terdaftar sebagai peserta event ini.' } });
    if (assessment.reason === 'TEST_NOT_PUBLISHED') return response.status(409).json({ error: { code: 'TEST_NOT_PUBLISHED', message: 'Test belum dipublikasikan oleh pengisi acara.' } });
    if (assessment.reason === 'ALREADY_SUBMITTED') return response.status(409).json({ error: { code: 'ALREADY_SUBMITTED', message: 'Respons Anda sudah pernah dikirim.' } });
    response.json(assessment);
  } catch (error) { next(error); }
});

assessmentRouter.post('/access/:token/submit', async (request, response, next) => {
  const body = answersBody.safeParse(request.body);
  if (!body.success) return response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Jawaban tidak valid.' } });
  try {
    const result = await submitPublicAssessment(request.params.token, body.data.nip, body.data.answers);
    if (!result || result.reason) return response.status(409).json({ error: { code: result?.reason ?? 'NOT_ELIGIBLE', message: result?.reason === 'PARTICIPANT_NOT_FOUND' ? 'NIP tidak terdaftar sebagai peserta event ini.' : result?.reason === 'ALREADY_SUBMITTED' ? 'Respons Anda sudah pernah dikirim.' : 'Test belum dipublikasikan.' } });
    response.status(201).json(result);
  } catch (error) { next(error); }
});

assessmentRouter.post('/access/:token/feedback', async (request, response, next) => {
  const body = feedbackBody.safeParse(request.body);
  if (!body.success) return response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Feedback tidak valid.' } });
  try {
    const result = await submitFeedback(request.params.token, body.data.nip, body.data.entries);
    if (!result || result.reason) return response.status(409).json({ error: { code: result?.reason ?? 'NOT_ELIGIBLE', message: result?.reason === 'PARTICIPANT_NOT_FOUND' ? 'NIP tidak terdaftar sebagai peserta event ini.' : result?.reason === 'ALREADY_SUBMITTED' ? 'Feedback Anda sudah pernah dikirim.' : 'QR feedback tidak berlaku.' } });
    response.status(201).json(result);
  } catch (error) { next(error); }
});

assessmentRouter.post('/access/:token/attendance', async (request, response, next) => {
  const body = attendanceBody.safeParse(request.body);
  if (!body.success) return response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'NIP dan tanda tangan wajib diisi.' } });
  try {
    const result = await submitAttendance(request.params.token, body.data.nip, body.data.signatureData);
    if (!result || result.reason) return response.status(409).json({ error: { code: result?.reason ?? 'NOT_ELIGIBLE', message: result?.reason === 'PARTICIPANT_NOT_FOUND' ? 'NIP tidak terdaftar sebagai peserta event ini.' : result?.reason === 'ALREADY_SUBMITTED' ? 'Absensi Anda sudah pernah dikirim.' : 'QR absensi tidak berlaku.' } });
    response.status(201).json(result);
  } catch (error) { next(error); }
});

assessmentRouter.use(authenticate);

const canManage = async (request, response, eventId) => {
  if (response.locals.actor.isCoordinator) return true;
  const event = await getEvent(eventId, response.locals.actor);
  return Boolean(event && response.locals.actor.isEventTrainer);
};

assessmentRouter.get('/events/:id/qr', async (request, response, next) => {
  const parsed = idSchema.safeParse(request.params.id);
  if (!parsed.success) return response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Id acara tidak valid.' } });
  try {
    if (!await canManage(request, response, parsed.data)) return response.status(403).json({ error: { code: 'FORBIDDEN', message: 'Tidak berwenang.' } });
    response.json(await listQrAccess(parsed.data));
  } catch (error) { next(error); }
});

assessmentRouter.post('/events/:id/qr', async (request, response, next) => {
  const parsed = idSchema.safeParse(request.params.id);
  const parsedPurpose = purpose.safeParse(request.body?.purpose);
  if (!parsed.success || !parsedPurpose.success) return response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Purpose QR tidak valid.' } });
  try {
    if (!await canManage(request, response, parsed.data)) return response.status(403).json({ error: { code: 'FORBIDDEN', message: 'Tidak berwenang.' } });
    if (['pre_test', 'post_test'].includes(parsedPurpose.data)) {
      const readiness = await getAssessmentQrReadiness(parsed.data);
      if (!readiness.ok) {
        const messages = {
          TEST_NOT_CREATED: 'Soal belum dibuat. Buat soal terlebih dahulu.',
          TEST_NO_QUESTIONS: 'Soal belum diisi. Tambahkan minimal satu soal terlebih dahulu.',
          TEST_NOT_PUBLISHED: 'Soal belum dipublish. Publish soal terlebih dahulu.',
        };
        return response.status(409).json({ error: { code: readiness.reason, message: messages[readiness.reason] } });
      }
    }
    const qr = await createQrAccess(parsed.data, parsedPurpose.data, response.locals.actor.nip);
    response.status(201).json({ ...qr, url: `/assessment/access/${qr.token}` });
  } catch (error) {
    if (error?.number === 547 || error?.number === 2627 || error?.number === 2601) {
      return response.status(409).json({ error: { code: 'QR_SCHEMA_NOT_READY', message: 'Struktur QR belum siap. Restart server untuk menjalankan migrasi assessment.' } });
    }
    next(error);
  }
});

assessmentRouter.get('/events/:id/tests', async (request, response, next) => {
  const parsed = idSchema.safeParse(request.params.id);
  if (!parsed.success) return response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Id acara tidak valid.' } });
  try {
    if (!await canManage(request, response, parsed.data)) return response.status(403).json({ error: { code: 'FORBIDDEN', message: 'Tidak berwenang.' } });
    response.json(await listTestSets(parsed.data));
  } catch (error) { next(error); }
});

assessmentRouter.get('/events/:id/results', async (request, response, next) => {
  const parsed = idSchema.safeParse(request.params.id);
  if (!parsed.success) return response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Id acara tidak valid.' } });
  try {
    if (!await canManage(request, response, parsed.data)) return response.status(403).json({ error: { code: 'FORBIDDEN', message: 'Tidak berwenang.' } });
    response.json(await getAssessmentResults(parsed.data));
  } catch (error) { next(error); }
});

assessmentRouter.post('/events/:id/tests', async (request, response, next) => {
  const parsed = idSchema.safeParse(request.params.id);
  const type = testType.safeParse(request.body?.type);
  if (!parsed.success || !type.success) return response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Jenis test tidak valid.' } });
  try {
    if (!await canManage(request, response, parsed.data)) return response.status(403).json({ error: { code: 'FORBIDDEN', message: 'Tidak berwenang.' } });
    response.status(201).json(await createTestSet(parsed.data, type.data, response.locals.actor.nip));
  } catch (error) { next(error); }
});

assessmentRouter.post('/tests/:id/questions', async (request, response, next) => {
  const parsed = idSchema.safeParse(request.params.id);
  const body = questionBody.safeParse(request.body);
  if (!parsed.success || !body.success) return response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Soal tidak valid.' } });
  try {
    const { recordset } = await query('SELECT TOP 1 event_id FROM dbo.training_test_set WHERE id=@id', (r) => r.input('id', sql.Int, parsed.data));
    if (!recordset[0] || !await canManage(request, response, recordset[0].event_id)) return response.status(403).json({ error: { code: 'FORBIDDEN', message: 'Tidak berwenang.' } });
    response.status(201).json(body.data.type === 'essay' ? await addEssayQuestion(parsed.data, body.data) : await addMultipleChoiceQuestion(parsed.data, body.data));
  } catch (error) { next(error); }
});

assessmentRouter.get('/tests/:id/questions', async (request, response, next) => {
  const parsed = idSchema.safeParse(request.params.id);
  if (!parsed.success) return response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Id test tidak valid.' } });
  try {
    const { recordset } = await query('SELECT TOP 1 event_id FROM dbo.training_test_set WHERE id=@id', (r) => r.input('id', sql.Int, parsed.data));
    if (!recordset[0] || !await canManage(request, response, recordset[0].event_id)) return response.status(403).json({ error: { code: 'FORBIDDEN', message: 'Tidak berwenang.' } });
    response.json(await listQuestions(parsed.data));
  } catch (error) { next(error); }
});

assessmentRouter.delete('/tests/:id/questions/:type/:questionId', async (request, response, next) => {
  const testId = idSchema.safeParse(request.params.id);
  const questionId = idSchema.safeParse(request.params.questionId);
  const type = questionType.safeParse(request.params.type);
  if (!testId.success || !questionId.success || !type.success) return response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Soal tidak valid.' } });
  try {
    const { recordset } = await query('SELECT TOP 1 event_id FROM dbo.training_test_set WHERE id=@id', (r) => r.input('id', sql.Int, testId.data));
    if (!recordset[0] || !await canManage(request, response, recordset[0].event_id)) return response.status(403).json({ error: { code: 'FORBIDDEN', message: 'Tidak berwenang.' } });
    if (!await deleteQuestion(testId.data, type.data, questionId.data)) return response.status(409).json({ error: { code: 'QUESTION_LOCKED', message: 'Soal tidak ditemukan atau test sudah dipublikasikan.' } });
    response.status(204).end();
  } catch (error) { next(error); }
});

assessmentRouter.post('/tests/:id/publish', async (request, response, next) => {
  const parsed = idSchema.safeParse(request.params.id);
  if (!parsed.success) return response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Id test tidak valid.' } });
  try {
    const { recordset } = await query('SELECT TOP 1 event_id FROM dbo.training_test_set WHERE id=@id', (r) => r.input('id', sql.Int, parsed.data));
    if (!recordset[0] || !await canManage(request, response, recordset[0].event_id)) return response.status(403).json({ error: { code: 'FORBIDDEN', message: 'Tidak berwenang.' } });
    if (!await publishTestSet(parsed.data)) return response.status(409).json({ error: { code: 'TEST_EMPTY', message: 'Tambahkan minimal satu soal sebelum publish.' } });
    response.status(204).end();
  } catch (error) {
    if (error?.number === 547 || error?.number === 2601 || error?.number === 2627) {
      return response.status(409).json({ error: { code: 'PUBLISH_FAILED', message: 'Test belum dapat dipublikasikan. Pastikan soal sudah tersimpan dan migration assessment sudah dijalankan.' } });
    }
    next(error);
  }
});

assessmentRouter.delete('/tests/:id', async (request, response, next) => {
  const parsed = idSchema.safeParse(request.params.id);
  if (!parsed.success) return response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Id test tidak valid.' } });
  try {
    const { recordset } = await query('SELECT TOP 1 event_id FROM dbo.training_test_set WHERE id=@id', (r) => r.input('id', sql.Int, parsed.data));
    if (!recordset[0] || !await canManage(request, response, recordset[0].event_id)) return response.status(403).json({ error: { code: 'FORBIDDEN', message: 'Tidak berwenang.' } });
    if (!await deleteEmptyTestSet(parsed.data)) return response.status(409).json({ error: { code: 'TEST_NOT_EMPTY', message: 'Test yang sudah berisi soal tidak dapat dihapus.' } });
    response.status(204).end();
  } catch (error) { next(error); }
});
