import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import {
  addPeserta,
  createBatch,
  getBatch,
  listBatches,
  listMateri,
  removePeserta,
  setAbsensi,
  setBatchStatus,
  toggleMateri,
} from './ojt.repository.js';
import { addPesertaBody, createBatchBody, fieldErrors, setAbsensiBody, toggleMateriBody } from './ojt.schema.js';

const fail = (response, status, code, message, details) => {
  response.status(status).json({
    error: { code, message, requestId: response.locals.requestId, ...(details ? { details } : {}) },
  });
};

/** 2627 and 2601 are unique-constraint violations in SQL Server. */
const isDuplicate = (error) => error?.number === 2627 || error?.number === 2601;

const idParam = z.coerce.number().int().positive();

/** OJT is run by Human Capital, same as event creation. */
const requireHumanCapital = (response, actor) => {
  if (actor.departId !== '0300') {
    fail(response, 403, 'FORBIDDEN', 'OJT hanya untuk Departid 0300.');
    return false;
  }
  return true;
};

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
    response.status(201).json({ id: await addPeserta(parsedId.data, parsed.data) });
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
    const batch = await getBatch(parsedId.data);
    if (!batch) {
      fail(response, 404, 'BATCH_NOT_FOUND', 'Batch OJT tidak ditemukan.');
      return;
    }
    // Reject dates outside the batch rather than silently storing them: an
    // attendance row on a Sunday would quietly corrupt the completion rate.
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
    const batch = await getBatch(parsedId.data);
    if (!batch) {
      fail(response, 404, 'BATCH_NOT_FOUND', 'Batch OJT tidak ditemukan.');
      return;
    }
    const peserta = batch.peserta.find((item) => item.id === parsed.data.pesertaId);
    const materiDikenal = batch.materi.some((item) => item.id === parsed.data.materiId);
    if (!peserta || !materiDikenal) {
      fail(response, 400, 'DATA_TIDAK_VALID', 'Peserta atau materi tidak dikenal pada batch ini.');
      return;
    }
    const target =
      parsed.data.selesai ?? !peserta.materiSelesai.includes(parsed.data.materiId);
    const selesai = await toggleMateri(parsed.data.pesertaId, parsed.data.materiId, target, response.locals.actor.nip);
    response.status(200).json({ selesai });
  } catch (error) {
    next(error);
  }
});