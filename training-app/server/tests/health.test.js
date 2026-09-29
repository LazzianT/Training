import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

let server;
let baseUrl;

beforeAll(async () => {
  server = await new Promise((resolve) => {
    const instance = createApp().listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind to a port');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(
  () =>
    new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
);

describe('health endpoints', () => {
  it('returns liveness and a request id', async () => {
    const response = await fetch(`${baseUrl}/health/live`);
    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBeTruthy();
    await expect(response.json()).resolves.toMatchObject({ status: 'ok', service: 'training-api' });
  });

  it('reports readiness as degraded while the database pool is not connected', async () => {
    const response = await fetch(`${baseUrl}/health/ready`);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ status: 'degraded', service: 'training-api' });
  });
});

describe('POST /api/auth/login', () => {
  it('rejects a body missing the credential with the shared error shape', async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nip: '198504122010011001' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'VALIDATION_ERROR', requestId: expect.any(String) },
    });
  });

  it('returns 404 for an unknown route using the same error shape', async () => {
    const response = await fetch(`${baseUrl}/api/auth/tidak-ada`);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'NOT_FOUND', requestId: expect.any(String) },
    });
  });
});
