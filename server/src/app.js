import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { databaseReady } from './db/pool.js';
import { requestId } from './http/request-id.js';
import { logger } from './logger.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { employeeRouter } from './modules/employee/employee.routes.js';
import { eventRouter } from './modules/event/event.routes.js';
import { assessmentRouter } from './modules/assessment/assessment.routes.js';
import { ojtRouter } from './modules/ojt/ojt.routes.js';

export const createApp = () => {
  const app = express();
  const allowedOrigins = config.CORS_ORIGIN.split(',').map((value) => value.trim()).filter(Boolean);

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestId);

  app.get('/health/live', (_request, response) => {
    response.status(200).json({
      status: 'ok',
      service: 'training-api',
      requestId: response.locals.requestId,
    });
  });

  app.get('/health/ready', async (_request, response) => {
    const ready = await databaseReady().catch(() => false);
    response.status(ready ? 200 : 503).json({
      status: ready ? 'ok' : 'degraded',
      service: 'training-api',
      requestId: response.locals.requestId,
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/employees', employeeRouter);
  app.use('/api/events', eventRouter);
  app.use('/api/assessment', assessmentRouter);
  app.use('/api/ojt', ojtRouter);

  app.use((_request, response) => {
    response.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Resource not found', requestId: response.locals.requestId },
    });
  });

  app.use((error, _request, response, _next) => {
    logger.error({ err: error, requestId: response.locals.requestId }, 'Unhandled request error');
    response.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        requestId: response.locals.requestId,
      },
    });
  });

  return app;
};
