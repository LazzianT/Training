import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { publicAppUrl } from '../../config.js';
import {
  addPeserta,
  createBatch,
  createJadwal,
  createMateri,
  deleteJadwal,
  findPengisi,
  getBatch,
  listAllMateri,
  listBatches,
  listMateri,
  moveMateri,
  removePeserta,
  setAbsensi,
  setBatchStatus,
  setMateriAktif,
  toggleMateri,
  updateJadwal,
  updateMateri,
} from './ojt.repository.js';
import {
  addQuestion,
  createQr,
  deleteQuestion,
  ensureTestSet,
  findPeserta,
  findPublishedTestSet,
  findTestSet,
  getAssessmentSummary,
  getOrCreateSession,
  getResults,
  getSession,
  listBatchPeserta,
  listQuestions,
  loadAssessment,
  publishTestSet,
  recordAttendance,
  resolveQr,
  submitAnswers,
  submitFeedback,
  unpublishTestSet,
} from './ojt.assessment.repository.js';
import {
  addPesertaBody,
  createBatchBody,
  createJadwalBody,
  fieldErrors,
  materiAktifBody,
  materiBody,
  materiMoveBody,
  setAbsensiBody,
  toggleMateriBody,
  updateJadwalBody,
  updateMateriBody,
} from './ojt.schema.js';

const fail = (response, status, code, message, details) => {
  response.status(status).json({
    error: { code, message, requestId: response.locals.requestId, ...(details ? { details } : {}) },
  });
};

const isDuplicate = (error) => error?.number === 2627 || error?.number === 2601;
const idParam = z.coerce.number().int().positive();

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

/* ------------------------------------------------------------------- master materi */

/*
  The catalog itself, as a maintenance screen rather than a picker: it shows
  inactive rows and how many schedules and completions point at each material,
  because that count is the reason removal is a deactivation.
*/
ojtRouter.get('/materi/master', async (request, response, next) => {
  if (!requireHumanCapital(response, response.locals.actor)) return;
  try {
    response.status(200).json(await listAllMateri());
  } catch (error) {
    next(error);
  }
});

ojtRouter.post('/materi/master', async (request, response, next) => {
  if (!requireHumanCapital(response, response.locals.actor)) return;
  const parsed = materiBody.safeParse(request.body);
  if (!parsed.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Periksa kembali isian yang ditandai.', fieldErrors(parsed.error));
    return;
  }
  try {
    response.status(201).json({ id: await createMateri(parsed.data) });
  } catch (error) {
    respondToDomainError(response, error, () => next(error));
  }
});

ojtRouter.patch('/materi/master/:materiId', async (request, response, next) => {
  if (!requireHumanCapital(response, response.locals.actor)) return;
  const parsedId = idParam.safeParse(request.params.materiId);
  if (!parsedId.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Id materi tidak valid.');
    return;
  }
  const parsed = updateMateriBody.safeParse(request.body);
  if (!parsed.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Periksa kembali isian yang ditandai.', fieldErrors(parsed.error));
    return;
  }
  try {
    await updateMateri(parsedId.data, parsed.data);
    response.status(200).json({ id: parsedId.data });
  } catch (error) {
    respondToDomainError(response, error, () => next(error));
  }
});

ojtRouter.patch('/materi/master/:materiId/aktif', async (request, response, next) => {
  if (!requireHumanCapital(response, response.locals.actor)) return;
  const parsedId = idParam.safeParse(request.params.materiId);
  const parsed = materiAktifBody.safeParse(request.body);
  if (!parsedId.success || !parsed.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Permintaan tidak valid.');
    return;
  }
  try {
    await setMateriAktif(parsedId.data, parsed.data.aktif);
    response.status(200).json({ id: parsedId.data, aktif: parsed.data.aktif });
  } catch (error) {
    respondToDomainError(response, error, () => next(error));
  }
});

ojtRouter.post('/materi/master/:materiId/move', async (request, response, next) => {
  if (!requireHumanCapital(response, response.locals.actor)) return;
  const parsedId = idParam.safeParse(request.params.materiId);
  const parsed = materiMoveBody.safeParse(request.body);
  if (!parsedId.success || !parsed.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Permintaan tidak valid.');
    return;
  }
  try {
    const moved = await moveMateri(parsedId.data, parsed.data.direction);
    // Not an error: the material is already first or already last.
    response.status(200).json({ id: parsedId.data, moved });
  } catch (error) {
    respondToDomainError(response, error, () => next(error));
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
  MATERI_SUDAH_ADA: [409, 'MATERI_SUDAH_ADA', 'Materi dengan nama itu sudah ada di katalog.'],
  MATERI_NOT_FOUND: [404, 'MATERI_NOT_FOUND', 'Materi tidak ditemukan.'],
  MATERI_SUDAH_DIJADWALKAN: [
    409,
    'MATERI_SUDAH_DIJADWALKAN',
    'Materi ini sudah ada di jadwal batch pada tanggal lain. Satu materi hanya bisa dijadwalkan satu hari.',
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

/*
  The question bank belongs to the material, not the batch: a Safety Induction
  test is written once and every batch that teaches the material reuses it. The
  day it runs and who presents it live on the schedule.

  POST rather than PUT because it is an ensure, not a create. Two people opening
  the editor for the same material at the same time have to converge on one bank
  rather than race for the unique constraint on materi_id.
*/
ojtRouter.get('/materi/:materiId/test-set', async (request, response, next) => {
  if (!requireHumanCapital(response, response.locals.actor)) return;
  const parsedId = idParam.safeParse(request.params.materiId);
  if (!parsedId.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Id materi tidak valid.');
    return;
  }
  try {
    const found = await findTestSet(parsedId.data);
    if (!found) {
      fail(response, 404, 'TEST_SET_NOT_FOUND', 'Bank soal untuk materi ini belum dibuat.');
      return;
    }
    response.status(200).json(found);
  } catch (error) {
    next(error);
  }
});

ojtRouter.post('/materi/:materiId/test-set', async (request, response, next) => {
  if (!requireHumanCapital(response, response.locals.actor)) return;
  const parsedId = idParam.safeParse(request.params.materiId);
  if (!parsedId.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Id materi tidak valid.');
    return;
  }
  try {
    const found = await ensureTestSet(parsedId.data);
    response.status(found.created ? 201 : 200).json(found);
  } catch (error) {
    next(error);
  }
});

/* --------------------------------------------------------- question authoring */

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

/*
  Back to draft. Needed because publish locks the question count in: once
  published, a typo can no longer be corrected without republishing a paper that
  participants have already answered. Answers already taken keep their own graded
  rows, so this only reopens authoring.
*/
ojtRouter.post('/test-sets/:testSetId/unpublish', async (request, response, next) => {
  if (!requireHumanCapital(response, response.locals.actor)) return;
  const parsedId = idParam.safeParse(request.params.testSetId);
  if (!parsedId.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Id test set tidak valid.');
    return;
  }
  try {
    if (!(await unpublishTestSet(parsedId.data))) {
      fail(response, 409, 'UNPUBLISH_FAILED', 'Test set tidak dalam status draft.');
      return;
    }
    response.status(200).json({ status: 'draft' });
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

/*
  Per material readiness for every scheduled material in a batch.

  The screen calls this before printing a QR, so it can say that a pre-test would
  open an empty form instead of handing the code out first.
*/
ojtRouter.get('/batches/:id/assessment', async (request, response, next) => {
  if (!requireHumanCapital(response, response.locals.actor)) return;
  const parsedId = idParam.safeParse(request.params.id);
  if (!parsedId.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Id batch tidak valid.');
    return;
  }
  try {
    await withBatch(response, parsedId.data, async () => {
      response.status(200).json(await getAssessmentSummary(parsedId.data));
    });
  } catch (error) {
    next(error);
  }
});

/*
  One QR per material per purpose.

  Checked against the schedule rather than the catalog: a QR for a material that
  is not in this batch's calendar is a code nobody can complete, because the
  attendance and feedback it writes are scoped to the schedule.
*/
ojtRouter.post('/batches/:id/materi/:materiId/qr', async (request, response, next) => {
  if (!requireHumanCapital(response, response.locals.actor)) return;
  const parsedId = idParam.safeParse(request.params.id);
  const materiId = idParam.safeParse(request.params.materiId);
  const purpose = z
    .enum(['pre_test', 'post_test', 'feedback', 'attendance'])
    .safeParse(request.body?.purpose);
  if (!parsedId.success || !materiId.success || !purpose.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Permintaan QR tidak valid.');
    return;
  }
  try {
    await withBatch(response, parsedId.data, async (batch) => {
      const scheduled = batch.jadwal.some((item) => item.materiId === materiId.data);
      if (!scheduled) {
        fail(response, 400, 'MATERI_TIDAK_DIJADWALKAN', 'Materi ini belum ada di jadwal batch.');
        return;
      }
      const token = await createQr(parsedId.data, materiId.data, purpose.data);
      response.status(201).json({
        token,
        /*
          Absolute, because this string is what gets encoded into the QR image and
          what the copy button puts on the clipboard. A relative path scans into
          a dead address.
        */
        url: `${publicAppUrl()}/ojt/access/${token}`,
        materiId: materiId.data,
        purpose: purpose.data,
      });
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
      /*
        The material is named up front. A participant holding a QR needs to know
        what they are being assessed on before typing their code, otherwise the
        first thing they learn is from the questions.
      */
      materiId: access.materi_id,
      materiKode: access.materi_kode,
      materiNama: access.materi_nama,
      materiTanggal: access.materi_tanggal,
      /*
        Sent with the payload rather than fetched separately: the picker needs it
        the moment the page loads, and it is name and code only.
      */
      peserta: await listBatchPeserta(access.batch_id),
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
        const outcome = await recordAttendance(access.batch_id, access.materi_id, peserta.id, signatureData);
        if (outcome === 'ALREADY_SUBMITTED') {
          publicError(response, 409, 'ALREADY_SUBMITTED', 'Absensi untuk materi ini sudah tercatat.');
          return;
        }
        if (outcome === 'OUT_OF_PERIOD') {
          publicError(response, 409, 'OUT_OF_PERIOD', 'Absensi hanya dapat diisi pada periode batch.');
          return;
        }
        if (outcome === 'MATERIAL_NOT_SCHEDULED') {
          publicError(response, 409, 'MATERI_TIDAK_DIJADWALKAN', 'Materi ini tidak ada di jadwal batch.');
          return;
        }
        response.status(200).json({
          nama: peserta.nama_lengkap,
          recorded: true,
          tanggal: access.materi_tanggal,
          materiNama: access.materi_nama,
        });
        return;
      }
      response.status(200).json({
        nama: peserta.nama_lengkap,
        materiNama: access.materi_nama,
        tanggal: access.materi_tanggal,
      });
      return;
    }

    if (access.purpose === 'feedback') {
      response.status(200).json({
        nama: peserta.nama_lengkap,
        pesertaId: peserta.id,
        materiNama: access.materi_nama,
      });
      return;
    }

    /*
      Resolved by material, not by scanning the batch's banks for the first
      published one. With the scope moved off the batch there is exactly one bank
      per material, so "the first published set in this batch" is no longer a
      meaningful question.
    */
    const phase = access.purpose === 'pre_test' ? 'pre' : 'post';
    const published = await findPublishedTestSet(access.materi_id);
    if (!published) {
      publicError(response, 409, 'TEST_NOT_READY', 'Soal untuk materi ini belum tersedia. Hubungi pengisi batch.');
      return;
    }
    const session = await getOrCreateSession(published.id, peserta.id, phase);
    if (session.status === 'locked') {
      publicError(response, 409, 'ALREADY_SUBMITTED', 'Anda sudah mengirim jawaban untuk tahap ini.');
      return;
    }
    response.status(200).json({
      nama: peserta.nama_lengkap,
      materiNama: access.materi_nama,
      phase,
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
    await submitFeedback(access.batch_id, access.materi_id, peserta.id, entries);
    response.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
});