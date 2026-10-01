import type {
  AddOjtPesertaRequest,
  ApiError,
  CreateOjtBatchRequest,
  CreateOjtJadwalRequest,
  OjtBatch,
  OjtBatchDetail,
  OjtBatchStatus,
  OjtQuestionInput,
  OjtResults,
  OjtSavedQuestion,
  OjtTestSet,
  UpdateOjtJadwalRequest,
} from '@training/contracts';
import { apiBaseUrl, ApiRequestError } from './auth.js';

type FieldErrors = Record<string, string[] | undefined> & { _root?: string[] };

/** Shared transport so the admin and public surfaces report failures identically. */
const call = async <T>(path: string, init: RequestInit = {}, anonymous = false): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiRequestError('NETWORK_ERROR', 'Tidak dapat menghubungi server', 0);
  }

  if (!anonymous && response.status === 401) {
    throw new ApiRequestError('TOKEN_EXPIRED', 'Sesi berakhir. Masuk kembali.', 401);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | (ApiError & { error?: { details?: FieldErrors } })
      | null;
    throw new ApiRequestError(
      body?.error?.code ?? body?.error.code ?? 'UNKNOWN_ERROR',
      body?.error?.message ?? body?.error.message ?? 'Permintaan gagal.',
      response.status,
      body?.error?.details,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
};

const admin = (token: string, json?: unknown): RequestInit => ({
  headers: {
    Authorization: `Bearer ${token}`,
    ...(json === undefined ? {} : { 'Content-Type': 'application/json' }),
  },
  ...(json === undefined ? {} : { body: JSON.stringify(json) }),
});

const send = (json: unknown): RequestInit => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(json),
});

/* ------------------------------------------------------------------- admin side */

export const fetchOjtBatches = (token: string, signal?: AbortSignal) =>
  call<OjtBatch[]>('/api/ojt/admin/batches', { ...admin(token), signal });

export const fetchOjtBatch = (token: string, batchId: number, signal?: AbortSignal) =>
  call<OjtBatchDetail>(`/api/ojt/admin/batches/${batchId}`, { ...admin(token), signal });

export const createOjtBatch = (token: string, body: CreateOjtBatchRequest) =>
  call<OjtBatch>('/api/ojt/admin/batches', { ...admin(token, body), method: 'POST' });

export const setOjtBatchStatus = (token: string, batchId: number, status: OjtBatchStatus) =>
  call<{ status: OjtBatchStatus }>(`/api/ojt/admin/batches/${batchId}/status`, {
    ...admin(token, { status }),
    method: 'PATCH',
  });

export const addOjtPeserta = (token: string, batchId: number, body: AddOjtPesertaRequest) =>
  call<{ id: number; kodePeserta: string }>(`/api/ojt/admin/batches/${batchId}/peserta`, {
    ...admin(token, body),
    method: 'POST',
  });

export const removeOjtPeserta = (token: string, pesertaId: number) =>
  call<void>(`/api/ojt/admin/peserta/${pesertaId}`, { ...admin(token), method: 'DELETE' });

export const createOjtJadwal = (token: string, batchId: number, body: CreateOjtJadwalRequest) =>
  call<{ id: number }>(`/api/ojt/admin/batches/${batchId}/jadwal`, {
    ...admin(token, body),
    method: 'POST',
  });

export const updateOjtJadwal = (token: string, jadwalId: number, body: UpdateOjtJadwalRequest) =>
  call<{ id: number }>(`/api/ojt/admin/jadwal/${jadwalId}`, {
    ...admin(token, body),
    method: 'PATCH',
  });

export const deleteOjtJadwal = (token: string, jadwalId: number) =>
  call<void>(`/api/ojt/admin/jadwal/${jadwalId}`, { ...admin(token), method: 'DELETE' });

export const recordOjtAbsensi = (
  token: string,
  batchId: number,
  entries: { pesertaId: number; tanggal: string; status: 'hadir' | 'tidak_hadir' | 'izin' }[],
) =>
  call<{ recorded: number }>(`/api/ojt/admin/batches/${batchId}/absensi`, {
    ...admin(token, { entries }),
    method: 'POST',
  });

export const setOjtMateriDone = (token: string, batchId: number, pesertaId: number, materiId: number, selesai: boolean) =>
  call<{ selesai: boolean }>(`/api/ojt/admin/batches/${batchId}/materi`, {
    ...admin(token, { pesertaId, materiId, selesai }),
    method: 'POST',
  });

export const fetchOjtTestSets = (token: string, batchId: number, signal?: AbortSignal) =>
  call<OjtTestSet[]>(`/api/ojt/admin/batches/${batchId}/test-sets`, { ...admin(token), signal });

export const createOjtTestSet = (token: string, batchId: number, type: 'pg' | 'essay' | 'mixed') =>
  call<{ id: number }>(`/api/ojt/admin/batches/${batchId}/test-sets`, {
    ...admin(token, { type }),
    method: 'POST',
  });

export const fetchOjtQuestions = (token: string, testSetId: number, signal?: AbortSignal) =>
  call<OjtSavedQuestion[]>(`/api/ojt/admin/test-sets/${testSetId}/questions`, {
    ...admin(token),
    signal,
  });

export const addOjtQuestion = (token: string, testSetId: number, body: OjtQuestionInput) =>
  call<{ ok: true }>(`/api/ojt/admin/test-sets/${testSetId}/questions`, {
    ...admin(token, body),
    method: 'POST',
  });

export const deleteOjtQuestion = (token: string, testSetId: number, questionId: number) =>
  call<void>(`/api/ojt/admin/test-sets/${testSetId}/questions/${questionId}`, {
    ...admin(token),
    method: 'DELETE',
  });

export const publishOjtTestSet = (token: string, testSetId: number) =>
  call<{ status: 'published' }>(`/api/ojt/admin/test-sets/${testSetId}/publish`, {
    ...admin(token),
    method: 'POST',
  });

export const fetchOjtResults = (token: string, batchId: number, signal?: AbortSignal) =>
  call<OjtResults>(`/api/ojt/admin/batches/${batchId}/results`, { ...admin(token), signal });

export const createOjtQr = (
  token: string,
  batchId: number,
  purpose: 'pre_test' | 'post_test' | 'feedback' | 'attendance',
) =>
  call<{ token: string; url: string }>(`/api/ojt/admin/batches/${batchId}/qr`, {
    ...admin(token, { purpose }),
    method: 'POST',
  });

/* --------------------------------------------------------------- participant side */

/** Anonymous: this runs before the participant has any account. */
export const fetchOjtAccess = (qrToken: string, signal?: AbortSignal) =>
  call<import('@training/contracts').OjtAccess>(
    `/api/ojt/access/${encodeURIComponent(qrToken)}`,
    { signal },
    true,
  );

export const openOjtAccess = (qrToken: string, kodePeserta: string, signatureData?: string) =>
  call<{
    nama: string;
    sessionId?: number;
    questions?: import('@training/contracts').OjtQuestion[];
    recorded?: boolean;
  }>(
    `/api/ojt/access/${encodeURIComponent(qrToken)}/open`,
    { ...send(signatureData ? { kodePeserta, signatureData } : { kodePeserta }), method: 'POST' },
    true,
  );

export const submitOjtAnswers = (qrToken: string, body: unknown) =>
  call<{ ok: true }>(`/api/ojt/access/${encodeURIComponent(qrToken)}/submit`, {
    ...send(body),
    method: 'POST',
  }, true);

export const submitOjtFeedback = (qrToken: string, body: unknown) =>
  call<{ ok: true }>(`/api/ojt/access/${encodeURIComponent(qrToken)}/feedback`, {
    ...send(body),
    method: 'POST',
  }, true);