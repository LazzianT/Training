import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

export const requestId: RequestHandler = (request, response, next) => {
  const id = request.header('x-request-id') ?? randomUUID();
  response.locals.requestId = id;
  response.setHeader('x-request-id', id);
  next();
};
