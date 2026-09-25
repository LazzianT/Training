import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { HealthStatus } from '@training/contracts';
import { config } from './config.js';
import { requestId } from './http/request-id.js';
import { logger } from './logger.js';

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGIN }));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestId);

  app.get('/health/live', (_request, response) => {
    const body: HealthStatus = {
      status: 'ok',
      service: 'training-api',
      requestId: response.locals.requestId,
    };
    response.status(200).json(body);
  });

  app.get('/health/ready', (_request, response) => {
    const body: HealthStatus = {
      status: 'degraded',
      service: 'training-api',
      requestId: response.locals.requestId,
    };
    response.status(503).json(body);
  });

  app.use((_request, response) => {
    response.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
        requestId: response.locals.requestId,
      },
    });
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    const requestIdValue = response.locals.requestId;
    logger.error({ err: error, requestId: requestIdValue }, 'Unhandled request error');
    response.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        requestId: requestIdValue,
      },
    });
  });

  return app;
};
