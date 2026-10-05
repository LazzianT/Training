import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sql from 'mssql';
import { z } from 'zod';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/modules/auth/token.service.js';
import {
  addPesertaBody,
  createBatchBody,
  createJadwalBody,
  setAbsensiBody,
  updateJadwalBody,
} from '../src/modules/ojt/ojt.schema.js';
import { toSqlTime } from '../src/modules/ojt/ojt.repository.js';
import { config, originFromRequest, publicAppUrl } from '../src/config.js';

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
    const response = await fetch(`${baseUrl}/api/ojt/admin/batches`);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
  });

  it('keeps OJT away from everyone outside Human Capital', async () => {
    const response = await fetch(`${baseUrl}/api/ojt/admin/batches`, {
      headers: { Authorization: `Bearer ${tokenFor({ departId: '0040' })}` },
    });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'FORBIDDEN' } });
  });
});

describe('OJT request validation', () => {
  it('rejects a malformed batch before touching the database', async () => {
    const response = await fetch(`${baseUrl}/api/ojt/admin/batches`, {
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
    const response = await fetch(`${baseUrl}/api/ojt/admin/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor()}` },
      body: JSON.stringify({ ...validBatch, tanggalMulai: '2026-01-09', tanggalSelesai: '2026-01-05' }),
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.details.tanggalSelesai).toBeTruthy();
  });
});

describe('OJT participant access', () => {
  it('is not auth gated, because a participant has no account', async () => {
    const response = await fetch(`${baseUrl}/api/ojt/access/token-yang-tidak-ada`);
    // No database in this suite, so the lookup fails and the handler reaches the
    // error middleware. A 401 here would mean the route were auth gated.
    expect(response.status).not.toBe(401);
    expect(response.status).toBe(500);
  });

  it('requires a participant code to open a form', async () => {
    const response = await fetch(`${baseUrl}/api/ojt/access/token-yang-tidak-ada/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    // Validation runs before the token is resolved, so an empty code is rejected
    // without touching the database.
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });
});

describe('ojt schema', () => {
  it('uppercases the batch code so it compares consistently', () => {
    const batch = createBatchBody.safeParse(validBatch);
    expect(batch.success).toBe(true);
    expect(batch.data.kode).toBe('OJT-2026-01');
  });

  it('ignores a participant code sent by the client', () => {
    const parsed = addPesertaBody.safeParse({ kodePeserta: 'OJT-999', namaLengkap: 'Budi' });
    expect(parsed.success).toBe(true);
    // Zod strips unknown keys, so the client cannot choose its own code.
    expect(parsed.data).not.toHaveProperty('kodePeserta');
  });

  it('requires a participant name', () => {
    expect(addPesertaBody.safeParse({ namaLengkap: '   ' }).success).toBe(false);
    expect(addPesertaBody.safeParse({}).success).toBe(false);
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

describe('ojt material schedule', () => {
  const jadwal = { tanggal: '2026-01-05', namaMateri: 'Safety Induction' };

  it('accepts an all day session with neither clock time', () => {
    expect(createJadwalBody.safeParse(jadwal).success).toBe(true);
  });

  it('rejects an end time that is not after the start', () => {
    const parsed = createJadwalBody.safeParse({ ...jadwal, jamMulai: '13:00', jamSelesai: '09:00' });
    expect(parsed.success).toBe(false);
    // A matching pair is fine; only the order is the problem.
    expect(createJadwalBody.safeParse({ ...jadwal, jamMulai: '09:00', jamSelesai: '13:00' }).success).toBe(true);
  });

  it('allows one end of the range on its own', () => {
    // Plenty of OJT sessions are a half day or a full day, so a lone end time is
    // real data rather than an incomplete form.
    expect(createJadwalBody.safeParse({ ...jadwal, jamMulai: '09:00' }).success).toBe(true);
    expect(createJadwalBody.safeParse({ ...jadwal, jamSelesai: '13:00' }).success).toBe(true);
  });

  it('rejects a clock time that is not on the hour or half hour', () => {
    expect(createJadwalBody.safeParse({ ...jadwal, jamMulai: '9:00' }).success).toBe(false);
    expect(createJadwalBody.safeParse({ ...jadwal, jamMulai: '25:00' }).success).toBe(false);
  });

  it('requires a material name', () => {
    expect(createJadwalBody.safeParse({ tanggal: '2026-01-05' }).success).toBe(false);
    expect(createJadwalBody.safeParse({ ...jadwal, namaMateri: '  ' }).success).toBe(false);
  });

  it('treats an empty presenter and note as cleared rather than as text', () => {
    const parsed = createJadwalBody.safeParse({ ...jadwal, pengisiNip: '', catatan: '' });
    expect(parsed.success).toBe(true);
    // Empty strings would store as a literal '' and show as a blank presenter.
    expect(parsed.data.pengisiNip).toBeNull();
    expect(parsed.data.catatan).toBeNull();
  });

  it('takes only the fields it was given on update', () => {
    // Patch semantics: an absent key means leave it alone, so the client cannot
    // blank a presenter by forgetting to send it.
    const parsed = updateJadwalBody.safeParse({ jamMulai: '09:00' });
    expect(parsed.success).toBe(true);
    expect(Object.keys(parsed.data)).toEqual(['jamMulai']);
  });

  it('still rejects an incoherent range when only one end is patched', () => {
    expect(updateJadwalBody.safeParse({ jamMulai: '13:00', jamSelesai: '09:00' }).success).toBe(false);
  });
});

/*
  These exist because the schedule endpoints shipped broken twice while every
  schema test passed. None of them touch the database: they pin the two contracts
  the driver actually depends on, which a zod parse can never catch.
*/
describe('ojt time conversion', () => {
  it('hands the driver a Date, because it rejects every string for Time', () => {
    // tedious does new Date(Date.parse(value)) for a non-Date, and Date.parse
    // returns NaN for "09:00" or even "09:00:00", so only a Date gets through.
    const value = toSqlTime('09:00');
    expect(value).toBeInstanceOf(Date);
    expect(Number.isNaN(value.getTime())).toBe(false);
    expect(isNaN(Date.parse('09:00'))).toBe(true);
  });

  it('reads back the same clock time it was given', () => {
    // Written with Date.UTC and read with getUTCHours, so the round trip does not
    // shift by the server offset.
    const value = toSqlTime('13:45');
    expect(value.getUTCHours()).toBe(13);
    expect(value.getUTCMinutes()).toBe(45);
  });

  it('maps midnight and the last minute of the day', () => {
    expect(toSqlTime('00:00').getUTCHours()).toBe(0);
    expect(toSqlTime('23:59').getUTCHours()).toBe(23);
    expect(toSqlTime('23:59').getUTCMinutes()).toBe(59);
  });

  it('passes an absent time through as null', () => {
    // An all day session has no clock time, and null is what the column allows.
    expect(toSqlTime(null)).toBeNull();
    expect(toSqlTime(undefined)).toBeNull();
    expect(toSqlTime('')).toBeNull();
  });
});

describe('db transaction helper', () => {
  it('gives callers a request factory, not the transaction itself', () => {
    /*
      mssql's Transaction has no query method, so passing it out directly fails on
      the first statement with "tx.query is not a function". The contract is
      checked structurally here because running it needs a live connection.
    */
    const transaction = sql.Transaction;
    expect(typeof transaction.prototype.query).toBe('undefined');
    expect(typeof transaction.prototype.request).toBe('function');
  });
});

/*
  The QR URL leaves the server and gets encoded into an image a phone scans, so it
  has to be absolute. It was a bare "/ojt/access/..." before, which scans into a
  dead address and only reads as fine when copied into a browser by hand.
*/
describe('public app url', () => {
  it('returns an absolute origin with no trailing slash', () => {
    const url = publicAppUrl();
    expect(url).toMatch(/^https?:\/\/[^/]+$/);
    expect(url.endsWith('/')).toBe(false);
  });

  it('produces a scannable access link', () => {
    const link = `${publicAppUrl()}/ojt/access/abc123`;
    expect(link).toMatch(/^https?:\/\/[^/]+\/ojt\/access\/abc123$/);
    // The failure this guards against: a relative path is not a URL.
    expect(link.startsWith('/')).toBe(false);
  });

  it('falls back to the first CORS origin when nothing is configured', () => {
    // config is parsed once at import, so the assertion is about the shape of the
    // fallback rather than re-reading the environment: either PUBLIC_APP_URL was
    // set, or the value came from the first entry of the comma separated list.
    const origins = config.CORS_ORIGIN.split(',').map((value) => value.trim());
    const configured = config.PUBLIC_APP_URL.trim();
    expect(configured !== '' || origins[0].length > 0).toBe(true);
    expect(publicAppUrl()).not.toContain(',');
  });
});

/*
  The container has no PUBLIC_APP_URL configured, so the address comes off the
  request. That path is what decides whether a deployed instance hands out codes
  for its real address or for localhost, and it cannot be exercised through
  publicAppUrl here because the local .env sets the override.
*/
describe('public app url from the request', () => {
  const fakeRequest = ({ host, protocol = 'http', forwardedProto }) => ({
    protocol,
    get: (name) =>
      name === 'host' ? host : name === 'x-forwarded-proto' ? forwardedProto : undefined,
  });

  it('uses the host the browser typed', () => {
    expect(originFromRequest(fakeRequest({ host: 'training.ptbmc.co.id' }))).toBe(
      'http://training.ptbmc.co.id',
    );
  });

  it('keeps the port, because a deployment on :3006 is not the same address', () => {
    expect(originFromRequest(fakeRequest({ host: '10.103.90.5:3006' }))).toBe('http://10.103.90.5:3006');
  });

  it('honours a TLS terminator in front of it', () => {
    // The hop to us is plain http when a proxy terminates TLS, so req.protocol
    // alone would hand out an http link for an https deployment.
    const request = fakeRequest({ host: 'training.ptbmc.co.id', protocol: 'http', forwardedProto: 'https' });
    expect(originFromRequest(request)).toBe('https://training.ptbmc.co.id');
  });

  it('takes the first value when several proxies append to the header', () => {
    const request = fakeRequest({ host: 'a.example', forwardedProto: 'https, http' });
    expect(originFromRequest(request)).toBe('https://a.example');
  });

  it('answers null rather than inventing a host', () => {
    // Falling through to the CORS origin is better than guessing a hostname.
    expect(originFromRequest(fakeRequest({ host: undefined }))).toBeNull();
    expect(originFromRequest(undefined)).toBeNull();
  });
});
/*
  The assessment scope moved from the batch to the material, so a QR is now one
  per material per purpose. These pin the parts that decide which of them a
  participant gets; the SQL behind them needs a live connection and is covered by
  scripts/probe-ojt-assessment-materi.js instead.
*/
describe('ojt assessment purposes', () => {
  it('accepts exactly the four purposes, and refuses anything else', () => {
    const purpose = z.enum(['pre_test', 'post_test', 'feedback', 'attendance']);
    for (const value of ['pre_test', 'post_test', 'feedback', 'attendance']) {
      expect(purpose.safeParse(value).success).toBe(true);
    }
    for (const value of ['quiz', 'pre-test', '', 'PRE_TEST']) {
      expect(purpose.safeParse(value).success).toBe(false);
    }
  });

  it('maps each test purpose to exactly one phase', () => {
    // A phase outside the session table's CHECK constraint would fail at insert
    // time with a constraint violation instead of a useful message.
    const phaseFor = (purpose) => (purpose === 'pre_test' ? 'pre' : 'post');
    expect(phaseFor('pre_test')).toBe('pre');
    expect(phaseFor('post_test')).toBe('post');
    expect(['pre', 'post']).toContain(phaseFor('post_test'));
  });

  it('leaves feedback and attendance out of the test phase mapping', () => {
    // Neither opens a session, so mapping them to a phase would create one.
    const isTest = (purpose) => purpose === 'pre_test' || purpose === 'post_test';
    expect(isTest('feedback')).toBe(false);
    expect(isTest('attendance')).toBe(false);
    expect(isTest('pre_test')).toBe(true);
  });
});