import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import {
  addPeserta,
  createBatch,
  createJadwal,
  deleteJadwal,
  findPengisi,
  getBatch,
  listBatches,
  listMateri,
  removePeserta,
  setAbsensi,
  setBatchStatus,
  toggleMateri,
  updateJadwal,
} from './ojt.repository.js';
import {
  addQuestion,
  createQr,
  createTestSet,
  deleteQuestion,
  findPeserta,
  getOrCreateSession,
  getResults,
  getSession,
  listQuestions,
  listTestSets,
  loadAssessment,
  publishTestSet,
  recordAttendance,
  resolveQr,
  submitAnswers,
  submitFeedback,
} from './ojt.assessment.repository.js';
import {
  addPesertaBody,
  createBatchBody,
  createJadwalBody,
  fieldErrors,
  setAbsensiBody,
  toggleMateriBody,
  updateJadwalBody,
} from './ojt.schema.js';

const fail = (response, status, code, message, details) => {
  response.status(status).json({
    error: { code, message, requestId: response.locals.requestId, ...(details ? { details } : {}) },
  });
};

const isDuplicate = (error) => error?.number === 2627 || error?.number === 2601;
const idParam = z.coerce.number().int().positive();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal harus format YYYY-MM-DD');

const requireHumanCapital = (response, actor) => {
  if (actor.departId !== '0300') {
    fail(response, 403, 'FORBIDDEN', 'OJT hanya untuk Departid 0300.');
    return false;
  }
  return true;
};

/** Guard used by every batch-scoped handler so one check covers them all. */
const withBatch = async (response, batchId, handler) => {
  const batch = await getBatch(batchId);
  if (!batch) {
    fail(response, 404, 'BATCH_NOT_FOUND', 'Batch OJT tidak ditemukan.');
    return null;
  }
  await handler(batch);
  return batch;
};

/* --------------------------------------------------------- batch management */

export const ojtRouter = Router();

ojtRouter.use(authenticate);

ojtRouter.get('/materi', async (_request, response, next) => {
  try {
    response.status(200).json(await listMateri());
  } catch (error) {
    next(error);
  }
});

ojtRouter.get('/batches', async (request, response, next) => {
  if (!requireHumanCapital(response, response.locals.actor)) return;
  try {
    response.status(200).json(await listBatches());
  } catch (error) {
    next(error);
  }
});

ojtRouter.post('/batches', async (request, response, next) => {
  if (!requireHumanCapital(response, response.locals.actor)) return;
  const parsed = createBatchBody.safeParse(request.body);
  if (!parsed.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Periksa kembali isian yang ditandai.', fieldErrors(parsed.error));
    return;
  }
  try {
    response.status(201).json(await createBatch(parsed.data, response.locals.actor.nip));
  } catch (error) {
    if (isDuplicate(error)) {
      fail(response, 409, 'DUPLIKAT', 'Kode batch OJT sudah dipakai.');
      return;
    }
    next(error);
  }
});

ojtRouter.get('/batches/:id', async (request, response, next) => {
  if (!requireHumanCapital(response, response.locals.actor)) return;
  const parsedId = idParam.safeParse(request.params.id);
  if (!parsedId.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Id batch tidak valid.');
    return;
  }
  try {
    const batch = await getBatch(parsedId.data);
    if (!batch) {
      fail(response, 404, 'BATCH_NOT_FOUND', 'Batch OJT tidak ditemukan.');
      return;
    }
    response.status(200).json(batch);
  } catch (error) {
    next(error);
  }
});

ojtRouter.patch('/batches/:id/status', async (request, response, next) => {
  if (!requireHumanCapital(response, response.locals.actor)) return;
  const parsedId = idParam.safeParse(request.params.id);
  const status = z.enum(['draft', 'published', 'closed']).safeParse(request.body?.status);
  if (!parsedId.success || !status.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Status batch tidak valid.');
    return;
  }
  try {
    await setBatchStatus(parsedId.data, status.data);
    response.status(200).json({ status: status.data });
  } catch (error) {
    next(error);
  }
});

ojtRouter.post('/batches/:id/peserta', async (request, response, next) => {
  if (!requireHumanCapital(response, response.locals.actor)) return;
  const parsedId = idParam.safeParse(request.params.id);
  if (!parsedId.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Id batch tidak valid.');
    return;
  }
  const parsed = addPesertaBody.safeParse(request.body);
  if (!parsed.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Periksa kembali isian yang ditandai.', fieldErrors(parsed.error));
    return;
  }
  try {
    response.status(201).json(await addPeserta(parsedId.data, parsed.data.namaLengkap));
  } catch (error) {
    if (error?.message?.startsWith('BATCH_NOT_FOUND')) {
      fail(response, 404, 'BATCH_NOT_FOUND', 'Batch OJT tidak ditemukan.');
      return;
    }
    if (isDuplicate(error)) {
      fail(response, 409, 'DUPLIKAT', 'Kode peserta sudah dipakai pada batch ini.');
      return;
    }
    next(error);
  }
});

ojtRouter.delete('/peserta/:pesertaId', async (request, response, next) => {
  if (!requireHumanCapital(response, response.locals.actor)) return;
  const parsedId = idParam.safeParse(request.params.pesertaId);
  if (!parsedId.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Id peserta tidak valid.');
    return;
  }
  try {
    await removePeserta(parsedId.data);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

ojtRouter.post('/batches/:id/absensi', async (request, response, next) => {
  if (!requireHumanCapital(response, response.locals.actor)) return;
  const parsedId = idParam.safeParse(request.params.id);
  if (!parsedId.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Id batch tidak valid.');
    return;
  }
  const parsed = setAbsensiBody.safeParse(request.body);
  if (!parsed.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Data kehadiran tidak valid.', fieldErrors(parsed.error));
    return;
  }
  try {
    await withBatch(response, parsedId.data, async (batch) => {
      // Reject dates outside the batch rather than storing them: a row on a
      // Sunday would quietly corrupt the completion rate.
      const outside = parsed.data.entries.filter(
        (entry) => entry.tanggal < batch.tanggalMulai || entry.tanggal > batch.tanggalSelesai,
      );
      if (outside.length > 0) {
        fail(response, 400, 'TANGGAL_DI_LUAR_PERIODE', 'Ada tanggal kehadiran di luar periode batch.');
        return;
      }
      const known = new Set(batch.peserta.map((item) => item.id));
      if (parsed.data.entries.some((entry) => !known.has(entry.pesertaId))) {
        fail(response, 400, 'PESERTA_TIDAK_VALID', 'Ada peserta yang bukan anggota batch ini.');
        return;
      }
      await setAbsensi(parsed.data.entries, response.locals.actor.nip);
      response.status(200).json({ recorded: parsed.data.entries.length });
    });
  } catch (error) {
    next(error);
  }
});

ojtRouter.post('/batches/:id/materi', async (request, response, next) => {
  if (!requireHumanCapital(response, response.locals.actor)) return;
  const parsedId = idParam.safeParse(request.params.id);
  if (!parsedId.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Id batch tidak valid.');
    return;
  }
  const parsed = toggleMateriBody.safeParse(request.body);
  if (!parsed.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Data materi tidak valid.', fieldErrors(parsed.error));
    return;
  }
  try {
    await withBatch(response, parsedId.data, async (batch) => {
      const peserta = batch.peserta.find((item) => item.id === parsed.data.pesertaId);
      const materiDikenal = batch.materi.some((item) => item.id === parsed.data.materiId);
      if (!peserta || !materiDikenal) {
        fail(response, 400, 'DATA_TIDAK_VALID', 'Peserta atau materi tidak dikenal pada batch ini.');
        return;
      }
      const target = parsed.data.selesai ?? !peserta.materiSelesai.includes(parsed.data.materiId);
      const selesai = await toggleMateri(parsed.data.pesertaId, parsed.data.materiId, target, response.locals.actor.nip);
      response.status(200).json({ selesai });
    });
  } catch (error) {
    next(error);
  }
});

/* ---------------------------------------------------------------- material schedule */

/*
  Domain errors carry a code rather than a status, so one table decides the
  response and a new failure mode cannot accidentally come back as a 500.
*/
const DOMAIN_ERRORS = {
  BATCH_NOT_FOUND: [404, 'BATCH_NOT_FOUND', 'Batch OJT tidak ditemukan.'],
  JADWAL_NOT_FOUND: [404, 'JADWAL_NOT_FOUND', 'Jadwal materi tidak ditemukan.'],
  TANGGAL_DI_LUAR_RENTANG: [
    400,
    'TANGGAL_DI_LUAR_PERIODE',
    'Tanggal materi harus berada di dalam periode batch.',
  ],
  PENGISI_TIDAK_DIKENAL: [
    400,
    'PENGISI_TIDAK_DIKENAL',
    'Pengisi materi tidak ditemukan atau sudah tidak aktif.',
  ],
};

const respondToDomainError = (response, error, fallback) => {
  const mapped = DOMAIN_ERRORS[error?.code];
  if (!mapped) {
    fallback();
    return;
  }
  fail(response, ...mapped);
};

ojtRouter.post('/batches/:id/jadwal', async (request, response, next) => {
  if (!requireHumanCapital(response, response.locals.actor)) return;
  const parsedId = idParam.safeParse(request.params.id);
  if (!parsedId.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Id batch tidak valid.');
    return;
  }
  const parsed = createJadwalBody.safeParse(request.body);
  if (!parsed.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Periksa kembali isian yang ditandai.', fieldErrors(parsed.error));
    return;
  }
  try {
    if (parsed.data.pengisiNip && !(await findPengisi(parsed.data.pengisiNip))) {
      fail(response, 400, 'PENGISI_TIDAK_DIKENAL', 'Pengisi materi tidak ditemukan atau sudah tidak aktif.');
      return;
    }
    const id = await createJadwal(parsedId.data, parsed.data);
    response.status(201).json({ id });
  } catch (error) {
    respondToDomainError(response, error, () => next(error));
  }
});

ojtRouter.patch('/jadwal/:jadwalId', async (request, response, next) => {
  if (!requireHumanCapital(response, response.locals.actor)) return;
  const parsedId = idParam.safeParse(request.params.jadwalId);
  if (!parsedId.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Id jadwal tidak valid.');
    return;
  }
  const parsed = updateJadwalBody.safeParse(request.body);
  if (!parsed.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Periksa kembali isian yang ditandai.', fieldErrors(parsed.error));
    return;
  }
  try {
    if (parsed.data.pengisiNip && !(await findPengisi(parsed.data.pengisiNip))) {
      fail(response, 400, 'PENGISI_TIDAK_DIKENAL', 'Pengisi materi tidak ditemukan atau sudah tidak aktif.');
      return;
    }
    await updateJadwal(parsedId.data, parsed.data);
    response.status(200).json({ id: parsedId.data });
  } catch (error) {
    respondToDomainError(response, error, () => next(error));
  }
});

ojtRouter.delete('/jadwal/:jadwalId', async (request, response, next) => {
  if (!requireHumanCapital(response, response.locals.actor)) return;
  const parsedId = idParam.safeParse(request.params.jadwalId);
  if (!parsedId.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Id jadwal tidak valid.');
    return;
  }
  try {
    if (!(await deleteJadwal(parsedId.data))) {
      fail(response, 404, 'JADWAL_NOT_FOUND', 'Jadwal materi tidak ditemukan.');
      return;
    }
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

/* --------------------------------------------------------- question authoring */

ojtRouter.get('/batches/:id/test-sets', async (request, response, next) => {
  if (!requireHumanCapital(response, response.locals.actor)) return;
  const parsedId = idParam.safeParse(request.params.id);
  if (!parsedId.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Id batch tidak valid.');
    return;
  }
  try {
    response.status(200).json(await listTestSets(parsedId.data));
  } catch (error) {
    next(error);
  }
});

const questionBody = z.object({
  type: z.enum(['pg', 'essay']),
  text: z.string().trim().min(1, 'Pertanyaan wajib diisi').max(2000),
  a: z.string().trim().max(1000).optional(),
  b: z.string().trim().max(1000).optional(),
  c: z.string().trim().max(1000).optional(),
  d: z.string().trim().max(1000).optional(),
  correct: z.enum(['A', 'B', 'C', 'D']).optional(),
  instructions: z.string().trim().max(20_000).optional(),
  answerGuide: z.string().trim().max(20_000).optional(),
  imageData: z.string().max(2_000_000).optional(),
  point: z.coerce.number().min(0).max(1000).optional(),
});

ojtRouter.post('/batches/:id/test-sets', async (request, response, next) => {
  if (!requireHumanCapital(response, response.locals.actor)) return;
  const parsedId = idParam.safeParse(request.params.id);
  const body = z
    .object({ type: z.enum(['pg', 'essay', 'mixed']), testDate: isoDate.optional() })
    .safeParse(request.body ?? {});
  if (!parsedId.success || !body.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Data test set tidak valid.');
    return;
  }
  try {
    const id = await createTestSet(parsedId.data, body.data.type, response.locals.actor.nip, body.data.testDate ?? new Date().toISOString().slice(0, 10));
    response.status(201).json({ id });
  } catch (error) {
    next(error);
  }
});

ojtRouter.get('/test-sets/:testSetId/questions', async (request, response, next) => {
  if (!requireHumanCapital(response, response.locals.actor)) return;
  const parsedId = idParam.safeParse(request.params.testSetId);
  if (!parsedId.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Id test set tidak valid.');
    return;
  }
  try {
    response.status(200).json(await listQuestions(parsedId.data));
  } catch (error) {
    next(error);
  }
});

ojtRouter.post('/test-sets/:testSetId/questions', async (request, response, next) => {
  if (!requireHumanCapital(response, response.locals.actor)) return;
  const parsedId = idParam.safeParse(request.params.testSetId);
  const parsed = questionBody.safeParse(request.body ?? {});
  if (!parsedId.success || !parsed.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Soal tidak valid.', fieldErrors(parsed.error ?? { error: [] }));
    return;
  }
  if (parsed.data.type === 'pg') {
    const missing = ['a', 'b', 'c', 'd'].filter((key) => !parsed.data[key]);
    if (missing.length > 0 || !parsed.data.correct) {
      fail(response, 400, 'VALIDATION_ERROR', 'Pilihan ganda wajib memakai empat opsi dan satu kunci jawaban.');
      return;
    }
  }
  try {
    await addQuestion(parsedId.data, parsed.data);
    response.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

ojtRouter.delete('/test-sets/:testSetId/questions/:questionId', async (request, response, next) => {
  if (!requireHumanCapital(response, response.locals.actor)) return;
  const setId = idParam.safeParse(request.params.testSetId);
  const questionId = idParam.safeParse(request.params.questionId);
  if (!setId.success || !questionId.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Id tidak valid.');
    return;
  }
  try {
    await deleteQuestion(setId.data, questionId.data);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

ojtRouter.post('/test-sets/:testSetId/publish', async (request, response, next) => {
  if (!requireHumanCapital(response, response.locals.actor)) return;
  const parsedId = idParam.safeParse(request.params.testSetId);
  if (!parsedId.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Id test set tidak valid.');
    return;
  }
  try {
    if (!(await publishTestSet(parsedId.data))) {
      fail(response, 409, 'PUBLISH_FAILED', 'Test belum dapat dipublikasikan. Tambahkan minimal satu soal.');
      return;
    }
    response.status(200).json({ status: 'published' });
  } catch (error) {
    next(error);
  }
});

ojtRouter.get('/batches/:id/results', async (request, response, next) => {
  if (!requireHumanCapital(response, response.locals.actor)) return;
  const parsedId = idParam.safeParse(request.params.id);
  if (!parsedId.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Id batch tidak valid.');
    return;
  }
  try {
    response.status(200).json(await getResults(parsedId.data));
  } catch (error) {
    next(error);
  }
});

ojtRouter.post('/batches/:id/qr', async (request, response, next) => {
  if (!requireHumanCapital(response, response.locals.actor)) return;
  const parsedId = idParam.safeParse(request.params.id);
  const purpose = z
    .enum(['pre_test', 'post_test', 'feedback', 'attendance'])
    .safeParse(request.body?.purpose);
  if (!parsedId.success || !purpose.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Jenis QR tidak valid.');
    return;
  }
  try {
    await withBatch(response, parsedId.data, async () => {
      const token = await createQr(parsedId.data, purpose.data);
      response.status(201).json({ token, url: `/ojt/access/${token}` });
    });
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------ participant side */

/*
  Unauthenticated on purpose: this is the URL a participant opens by scanning a
  QR, before they have any account. Identity comes from the HR code, and every
  lookup is scoped to the batch the token belongs to.
*/
export const ojtPublicRouter = Router();

ojtPublicRouter.get('/access/:token', async (request, response, next) => {
  try {
    const access = await resolveQr(request.params.token);
    if (!access) {
      response.status(404).json({ error: { code: 'QR_EXPIRED', message: 'QR tidak berlaku.' } });
      return;
    }
    response.status(200).json({
      batchId: access.batch_id,
      purpose: access.purpose,
      title: access.judul,
      lokasi: access.lokasi ?? null,
      tanggalMulai: access.tanggal_mulai instanceof Date ? access.tanggal_mulai.toISOString().slice(0, 10) : String(access.tanggal_mulai).slice(0, 10),
      tanggalSelesai: access.tanggal_selesai instanceof Date ? access.tanggal_selesai.toISOString().slice(0, 10) : String(access.tanggal_selesai).slice(0, 10),
    });
  } catch (error) {
    next(error);
  }
});

const publicError = (response, status, code, message) =>
  response.status(status).json({ error: { code, message } });

ojtPublicRouter.post('/access/:token/open', async (request, response, next) => {
  try {
    const body = z.object({ kodePeserta: z.string().trim().min(1).max(50) }).safeParse(request.body ?? {});
    if (!body.success) {
      publicError(response, 400, 'VALIDATION_ERROR', 'Kode peserta wajib diisi.');
      return;
    }
    const access = await resolveQr(request.params.token);
    if (!access) {
      publicError(response, 404, 'QR_EXPIRED', 'QR tidak berlaku.');
      return;
    }
    const peserta = await findPeserta(access.batch_id, body.data.kodePeserta);
    if (!peserta) {
      publicError(response, 404, 'PESERTA_NOT_FOUND', 'Kode peserta tidak terdaftar pada batch ini.');
      return;
    }

    if (access.purpose === 'attendance') {
      // Opening only identifies the participant. Attendance is recorded when a
      // signature comes with the request, so nobody is marked present for having
      // merely scanned the QR.
      const signature = z
        .object({ signatureData: z.string().max(2_000_000).optional().nullable() })
        .safeParse(request.body ?? {});
      const signatureData = signature.success ? signature.data.signatureData : null;

      if (signatureData) {
        const outcome = await recordAttendance(access.batch_id, peserta.id, signatureData);
        if (outcome === 'ALREADY_SUBMITTED') {
          publicError(response, 409, 'ALREADY_SUBMITTED', 'Absensi hari ini sudah tercatat.');
          return;
        }
        if (outcome === 'OUT_OF_PERIOD') {
          publicError(response, 409, 'OUT_OF_PERIOD', 'Absensi hanya dapat diisi pada periode batch.');
          return;
        }
        response.status(200).json({ nama: peserta.nama_lengkap, recorded: true });
        return;
      }
      response.status(200).json({ nama: peserta.nama_lengkap });
      return;
    }

    if (access.purpose === 'feedback') {
      response.status(200).json({ nama: peserta.nama_lengkap, pesertaId: peserta.id });
      return;
    }

    const sets = await listTestSets(access.batch_id);
    const phase = access.purpose === 'pre_test' ? 'pre' : 'post';
    const published = sets.find((item) => item.status === 'published' && item.questionCount > 0);
    if (!published) {
      publicError(response, 409, 'TEST_NOT_READY', 'Soal belum tersedia. Hubungi pengisi batch.');
      return;
    }
    const session = await getOrCreateSession(published.id, peserta.id, phase);
    if (session.status === 'locked') {
      publicError(response, 409, 'ALREADY_SUBMITTED', 'Anda sudah mengirim jawaban untuk tahap ini.');
      return;
    }
    response.status(200).json({
      nama: peserta.nama_lengkap,
      sessionId: session.id,
      questions: await loadAssessment(published.id),
    });
  } catch (error) {
    next(error);
  }
});

ojtPublicRouter.post('/access/:token/submit', async (request, response, next) => {
  try {
    const body = z
      .object({
        kodePeserta: z.string().trim().min(1).max(50),
        sessionId: z.coerce.number().int().positive(),
        answers: z
          .array(z.object({ questionId: z.coerce.number().int().positive(), answer: z.enum(['A', 'B', 'C', 'D']) }))
          .min(1)
          .max(500),
      })
      .safeParse(request.body ?? {});
    if (!body.success) {
      publicError(response, 400, 'VALIDATION_ERROR', 'Jawaban tidak valid.');
      return;
    }
    const access = await resolveQr(request.params.token);
    if (!access) {
      publicError(response, 404, 'QR_EXPIRED', 'QR tidak berlaku.');
      return;
    }
    const peserta = await findPeserta(access.batch_id, body.data.kodePeserta);
    if (!peserta) {
      publicError(response, 404, 'PESERTA_NOT_FOUND', 'Kode peserta tidak terdaftar pada batch ini.');
      return;
    }
    const session = await getSession(body.data.sessionId);
    if (!session) {
      publicError(response, 404, 'SESSION_NOT_FOUND', 'Sesi tidak ditemukan.');
      return;
    }
    // A session id alone is not proof of identity: it must belong to the
    // participant who presented this code, or anyone could submit on their behalf.
    if (session.peserta_id !== peserta.id) {
      publicError(response, 403, 'FORBIDDEN', 'Sesi ini bukan milik kode peserta tersebut.');
      return;
    }
    if (session.status === 'locked') {
      publicError(response, 409, 'ALREADY_SUBMITTED', 'Jawaban untuk tahap ini sudah dikirim.');
      return;
    }
    await submitAnswers(body.data.sessionId, session.test_set_id, body.data.answers);
    response.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

ojtPublicRouter.post('/access/:token/feedback', async (request, response, next) => {
  try {
    const body = z
      .object({
        kodePeserta: z.string().trim().min(1).max(50),
        comment: z.string().trim().max(5000).optional().nullable(),
        entries: z
          .array(
            z.object({
              aspect: z.string().trim().min(1).max(100),
              score: z.coerce.number().min(1).max(5),
              comment: z.string().trim().max(5000).optional().nullable(),
            }),
          )
          .min(1)
          .max(50),
      })
      .safeParse(request.body ?? {});
    if (!body.success) {
      publicError(response, 400, 'VALIDATION_ERROR', 'Feedback tidak valid.');
      return;
    }
    const access = await resolveQr(request.params.token);
    if (!access) {
      publicError(response, 404, 'QR_EXPIRED', 'QR tidak berlaku.');
      return;
    }
    const peserta = await findPeserta(access.batch_id, body.data.kodePeserta);
    if (!peserta) {
      publicError(response, 404, 'PESERTA_NOT_FOUND', 'Kode peserta tidak terdaftar pada batch ini.');
      return;
    }
    const entries = body.data.entries.map((entry) => ({
      aspect: entry.aspect,
      score: entry.score,
      comment: entry.comment ?? body.data.comment ?? null,
    }));
    await submitFeedback(access.batch_id, peserta.id, entries);
    response.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
});