import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { getEmployeeTrainingHistory, monitorEmployees, searchEmployees, suggestEmployeesForTraining } from './employee.repository.js';

const querySchema = z.object({
  q: z.string().max(50).default(''),
  limit: z.coerce.number().int().min(1).max(200).default(60),
});

export const employeeRouter = Router();

employeeRouter.use(authenticate);

employeeRouter.use((request, response, next) => {
  if (response.locals.actor.departId !== '0300') {
    response.status(403).json({ error: { code: 'FORBIDDEN', message: 'Akses hanya untuk Departid 0300', requestId: response.locals.requestId } });
    return;
  }
  next();
});

employeeRouter.get('/', async (request, response, next) => {
  const parsed = querySchema.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Pencarian tidak valid', requestId: response.locals.requestId },
    });
    return;
  }

  try {
    response.status(200).json(await searchEmployees(parsed.data.q, parsed.data.limit));
  } catch (error) {
    next(error);
  }
});

employeeRouter.get('/suggestions', async (request, response, next) => {
  const title = String(request.query.title ?? '').trim();
  const parsed = querySchema.safeParse(request.query);
  if (!title || title.length > 200 || !/[a-z0-9]/i.test(title) || !parsed.success) return response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Judul training tidak valid', requestId: response.locals.requestId } });
  try {
    response.status(200).json(await suggestEmployeesForTraining(title, parsed.data.q, parsed.data.limit));
  } catch (error) {
    next(error);
  }
});

employeeRouter.get('/monitoring', async (request, response, next) => {
  const parsed = querySchema.safeParse(request.query);
  if (!parsed.success) return response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Pencarian tidak valid', requestId: response.locals.requestId } });
  try {
    response.status(200).json(await monitorEmployees(parsed.data.q, parsed.data.limit));
  } catch (error) {
    next(error);
  }
});

employeeRouter.get('/monitoring/:nip/trainings', async (request, response, next) => {
  const nip = request.params.nip.trim();
  if (!nip || nip.length > 50) return response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'NIK tidak valid', requestId: response.locals.requestId } });
  try {
    response.status(200).json(await getEmployeeTrainingHistory(nip));
  } catch (error) {
    next(error);
  }
});
