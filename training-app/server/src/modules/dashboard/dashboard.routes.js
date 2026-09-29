import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { getDashboardSummary } from './summary.service.js';

const query = z.object({
  year: z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()),
  month: z.coerce.number().int().min(1).max(12).default(new Date().getMonth() + 1),
});

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

dashboardRouter.get('/summary', async (request, response, next) => {
  const parsed = query.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Periode tidak valid', requestId: response.locals.requestId },
    });
    return;
  }

  try {
    response.status(200).json(await getDashboardSummary(parsed.data.year, parsed.data.month));
  } catch (error) {
    next(error);
  }
});
