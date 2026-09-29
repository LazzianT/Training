import { randomUUID } from 'node:crypto';

export const requestId = (request, response, next) => {
  const id = request.header('x-request-id') ?? randomUUID();
  response.locals.requestId = id;
  response.setHeader('x-request-id', id);
  next();
};
