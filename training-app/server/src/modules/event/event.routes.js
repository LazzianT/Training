import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { addParticipants, createEvent, getEvent, getMyEvents, listEvents, listRooms, removeParticipant, updateEvent } from './event.repository.js';
import { createEventBody, fieldErrors } from './event.schema.js';

const fail = (response, status, code, message, details) => {
  response.status(status).json({
    error: { code, message, requestId: response.locals.requestId, ...(details ? { details } : {}) },
  });
};

const eventId = z.coerce.number().int().positive();
const participantsBody = z.object({ nips: z.array(z.string().trim().min(1).max(50)).min(1).max(2000) });

export const eventRouter = Router();

eventRouter.use(authenticate);

eventRouter.get('/rooms', async (_request, response, next) => {
  try {
    response.status(200).json(await listRooms());
  } catch (error) {
    next(error);
  }
});

eventRouter.get('/', async (_request, response, next) => {
  if (response.locals.actor.departId !== '0300') return fail(response, 403, 'FORBIDDEN', 'List Event hanya untuk Departid 0300.');
  const now = new Date();
  const year = Number(_request.query.year ?? now.getFullYear());
  const month = Number(_request.query.month ?? now.getMonth() + 1);
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) return fail(response, 400, 'VALIDATION_ERROR', 'Periode event tidak valid.');
  try {
    response.status(200).json(await listEvents(response.locals.actor, year, month));
  } catch (error) {
    next(error);
  }
});

eventRouter.get('/my', async (_request, response, next) => {
  if (!response.locals.actor.isCoordinator && !response.locals.actor.isEventTrainer) {
    return fail(response, 403, 'FORBIDDEN', 'Anda bukan pengisi acara.');
  }
  try { response.status(200).json(await getMyEvents(response.locals.actor)); } catch (error) { next(error); }
});

eventRouter.get('/:id', async (request, response, next) => {
  const parsedId = eventId.safeParse(request.params.id);
  if (!parsedId.success) return fail(response, 400, 'VALIDATION_ERROR', 'Id acara tidak valid');
  try {
    const event = await getEvent(parsedId.data, response.locals.actor);
    if (!event) return fail(response, 404, 'EVENT_NOT_FOUND', 'Acara tidak ditemukan');
    response.status(200).json(event);
  } catch (error) { next(error); }
});

eventRouter.post('/', async (request, response, next) => {
  if (response.locals.actor.departId !== '0300') return fail(response, 403, 'FORBIDDEN', 'Hanya Departid 0300 yang dapat membuat event.');
  const parsed = createEventBody.safeParse(request.body);
  if (!parsed.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Periksa kembali isian yang ditandai.', fieldErrors(parsed.error));
    return;
  }

  try {
    const id = await createEvent(parsed.data, response.locals.actor.nip);
    response.status(201).json({ id });
  } catch (error) {
    // 2627 / 2601 and 547 are constraint violations: report them honestly
    // instead of letting the generic handler call it an internal error.
    if (error?.number === 547) {
      fail(response, 400, 'RUANG_TIDAK_ADA', 'Ruang acara yang dipilih tidak tersedia.');
      return;
    }
    if (error?.number === 2627 || error?.number === 2601) {
      fail(response, 409, 'DUPLIKAT', 'Data acara sudah ada.');
      return;
    }
    next(error);
  }
});

eventRouter.put('/:id', async (request, response, next) => {
  if (response.locals.actor.departId !== '0300') return fail(response, 403, 'FORBIDDEN', 'Hanya Departid 0300 yang dapat mengubah event.');
  const parsedId = eventId.safeParse(request.params.id);
  const parsed = createEventBody.safeParse(request.body);
  if (!parsedId.success) return fail(response, 400, 'VALIDATION_ERROR', 'Id acara tidak valid');
  if (!parsed.success) return fail(response, 400, 'VALIDATION_ERROR', 'Periksa kembali isian yang ditandai.', fieldErrors(parsed.error));
  try {
    await updateEvent(parsedId.data, parsed.data, response.locals.actor.nip);
    response.status(204).end();
  } catch (error) { next(error); }
});

eventRouter.post('/:id/peserta', async (request, response, next) => {
  if (response.locals.actor.departId !== '0300') return fail(response, 403, 'FORBIDDEN', 'Hanya Departid 0300 yang dapat mengubah peserta.');
  const parsedId = eventId.safeParse(request.params.id);
  const body = participantsBody.safeParse(request.body);
  if (!parsedId.success || !body.success) return fail(response, 400, 'VALIDATION_ERROR', 'Daftar peserta tidak valid.');
  try {
    if (!await getEvent(parsedId.data, response.locals.actor)) return fail(response, 404, 'EVENT_NOT_FOUND', 'Acara tidak ditemukan.');
    response.status(201).json(await addParticipants(parsedId.data, body.data.nips));
  } catch (error) { next(error); }
});

eventRouter.delete('/:id/peserta/:nip', async (request, response, next) => {
  if (response.locals.actor.departId !== '0300') return fail(response, 403, 'FORBIDDEN', 'Hanya Departid 0300 yang dapat mengubah peserta.');
  const parsedId = eventId.safeParse(request.params.id);
  const nip = String(request.params.nip ?? '').trim();
  if (!parsedId.success || !nip || nip.length > 50) {
    return fail(response, 400, 'VALIDATION_ERROR', 'Peserta tidak valid.');
  }
  try {
    if (!await getEvent(parsedId.data, response.locals.actor)) return fail(response, 404, 'EVENT_NOT_FOUND', 'Acara tidak ditemukan.');
    const removed = await removeParticipant(parsedId.data, nip);
    if (!removed) return fail(response, 404, 'PARTICIPANT_NOT_FOUND', 'Peserta tidak ditemukan pada acara ini.');
    response.status(204).end();
  } catch (error) { next(error); }
});
