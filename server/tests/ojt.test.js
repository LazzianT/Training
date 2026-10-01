import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/modules/auth/token.service.js';
import { addPesertaBody, createBatchBody, setAbsensiBody } from '../src/modules/ojt/ojt.schema.js';

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

const tokenFor = (overrides = {}) =>
  signAccessToken({
    // authenticate() rejects anything without type 'access', so the test has to
    // mint a real access token rather than an arbitrary signed blob.
    type: 'access',
    sub: '0001',
    role: 'employee',
    departId: '0300',
    isEventTrainer: false,
    isCoordinator: false,
    sessionId: 'test-session',
    ...overrides,
  });

const validBatch = {
  kode: 'ojt-2026-01',
  judul: 'OJT wavedeck 2026 batch 1',
  tanggalMulai: '2026-01-05',
  tanggalSelesai: '2026-01-09',
};

describe('OJT authorisation', () => {
  it('rejects an unauthenticated request', async () => {
    const response = await fetch(`${baseUrl}/api/ojt/batches`);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
  });

  it('keeps OJT away from everyone outside Human Capital', async () => {
    const response = await fetch(`${baseUrl}/api/ojt/batches`, {
      headers: { Authorization: `Bearer ${tokenFor({ departId: '0040' })}` },
    });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'FORBIDDEN' } });
  });
});

describe('OJT request validation', () => {
  it('rejects a malformed batch before touching the database', async () => {
    const response = await fetch(`${baseUrl}/api/ojt/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor()}` },
      body: JSON.stringify({ ...validBatch, kode: 'batch dengan spasi' }),
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details.kode).toBeTruthy();
  });

  it('refuses an end date before the start date', async () => {
    const response = await fetch(`${baseUrl}/api/ojt/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor()}` },
      body: JSON.stringify({ ...validBatch, tanggalMulai: '2026-01-09', tanggalSelesai: '2026-01-05' }),
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.details.tanggalSelesai).toBeTruthy();
  });
});

describe('ojt schema', () => {
  it('uppercases the batch and participant codes so they compare consistently', () => {
    const batch = createBatchBody.safeParse(validBatch);
    expect(batch.success).toBe(true);
    expect(batch.data.kode).toBe('OJT-2026-01');

    const peserta = addPesertaBody.safeParse({ kodePeserta: 'ojt-001', namaLengkap: 'Budi' });
    expect(peserta.success).toBe(true);
    expect(peserta.data.kodePeserta).toBe('OJT-001');
  });

  it('requires a participant name and a well formed code', () => {
    expect(addPesertaBody.safeParse({ kodePeserta: 'OJT-001', namaLengkap: '   ' }).success).toBe(false);
    expect(addPesertaBody.safeParse({ kodePeserta: 'OJT/001', namaLengkap: 'Budi' }).success).toBe(false);
  });

  it('rejects a calendar date that does not exist', () => {
    expect(createBatchBody.safeParse({ ...validBatch, tanggalMulai: '2026-02-30' }).success).toBe(false);
  });

  it('accepts an empty attendance note but not an unknown status', () => {
    const base = { entries: [{ pesertaId: 1, tanggal: '2026-01-05', status: 'hadir' }] };
    expect(setAbsensiBody.safeParse(base).success).toBe(true);
    expect(setAbsensiBody.safeParse({ entries: [{ ...base.entries[0], status: 'maybe' }] }).success).toBe(false);
    expect(setAbsensiBody.safeParse({ entries: [] }).success).toBe(false);
  });
});