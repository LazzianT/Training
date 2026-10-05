import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { issueFor, listMine } from './certificate.repository.js';

/**
 * "My certificates": the signed-in employee only.
 *
 * There is deliberately no route to read someone else's certificates. A certificate
 * is a claim about a named person, and one employee should not be able to pull
 * another's off the system.
 */
export const certificateRouter = Router();

certificateRouter.use(authenticate);

const eventIdParam = z.coerce.number().int().positive();

const fail = (response, status, code, message) => {
  response.status(status).json({ error: { code, message, requestId: response.locals.requestId } });
};

certificateRouter.get('/mine', async (_request, response, next) => {
  try {
    response.status(200).json(await listMine(response.locals.actor.nip));
  } catch (error) {
    next(error);
  }
});

/*
  Issues on demand, when the employee actually prints.

  Nothing is created just for looking at the list, so the issued count on the
  dashboard stays a count of certificates that were really handed out rather than a
  count of who happened to open a page.
*/
certificateRouter.post('/mine/:eventId', async (request, response, next) => {
  const parsed = eventIdParam.safeParse(request.params.eventId);
  if (!parsed.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Id acara tidak valid.');
    return;
  }
  try {
    const certificate = await issueFor(response.locals.actor.nip, parsed.data);
    response.status(certificate.created ? 201 : 200).json(certificate);
  } catch (error) {
    if (error?.code === 'EVENT_NOT_FOUND') {
      fail(response, 404, 'EVENT_NOT_FOUND', 'Acara tidak ditemukan.');
      return;
    }
    if (error?.code === 'NOT_REGISTERED') {
      fail(response, 403, 'NOT_REGISTERED', 'Anda tidak terdaftar pada acara ini.');
      return;
    }
    if (error?.code === 'BELUM_HADIR') {
      fail(
        response,
        409,
        'BELUM_HADIR',
        'Sertifikat terbit setelah kehadiran Anda dicatat oleh Human Capital.',
      );
      return;
    }
    next(error);
  }
});
