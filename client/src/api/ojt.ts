import type {
  AddOjtPesertaRequest,
  ApiError,
  CreateOjtBatchRequest,
  OjtBatch,
  OjtBatchDetail,
  OjtBatchStatus,
  OjtMateri,
} from '@training/contracts';
import {
  createEventQr,
  fetchAssessmentResults,
  type AssessmentResults,
  type QrAccess,
} from './events.js';

export type { AssessmentResults };
export const fetchAssessmentResultsForEvent = fetchAssessmentResults;
export const createQrForEvent = createEventQr;
export type QrPurpose = QrAccess['purpose'];

import { apiBaseUrl, ApiRequestError } from './auth.js';

type FieldErrors = Record<string, string[] | undefined> & { _root?: string[] };

const call = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiRequestError('NETWORK_ERROR', 'Tidak dapat menghubungi server', 0);
  }

  if (response.status === 401) throw new ApiRequestError('TOKEN_EXPIRED', 'Sesi berakhir. Masuk kembali.', 401);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as (ApiError & { error?: { details?: FieldErrors } }) | null;
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

const auth = (token: string, json?: unknown): RequestInit => ({
  headers: {
    Authorization: `Bearer ${token}`,
    ...(json === undefined ? {} : { 'Content-Type': 'application/json' }),
  },
  ...(json === undefined ? {} : { body: JSON.stringify(json) }),
});

export const fetchOjtBatches = (token: string, signal?: AbortSignal) =>
  call<OjtBatch[]>('/api/ojt/batches', { ...auth(token), signal });

export const fetchOjtBatch = (token: string, batchId: number, signal?: AbortSignal) =>
  call<OjtBatchDetail>(`/api/ojt/batches/${batchId}`, { ...auth(token), signal });

export const fetchOjtMateri = (token: string, signal?: AbortSignal) =>
  call<OjtMateri[]>('/api/ojt/materi', { ...auth(token), signal });

export const createOjtBatch = (token: string, body: CreateOjtBatchRequest) =>
  call<OjtBatch>('/api/ojt/batches', { ...auth(token, body), method: 'POST' });

export const setOjtBatchStatus = (token: string, batchId: number, status: OjtBatchStatus) =>
  call<{ status: OjtBatchStatus }>(`/api/ojt/batches/${batchId}/status`, {
    ...auth(token, { status }),
    method: 'PATCH',
  });

export const addOjtPeserta = (token: string, batchId: number, body: AddOjtPesertaRequest) =>
  call<{ id: number }>(`/api/ojt/batches/${batchId}/peserta`, { ...auth(token, body), method: 'POST' });

export const removeOjtPeserta = (token: string, pesertaId: number) =>
  call<void>(`/api/ojt/peserta/${pesertaId}`, { ...auth(token), method: 'DELETE' });

export const recordOjtAbsensi = (
  token: string,
  batchId: number,
  entries: { pesertaId: number; tanggal: string; status: 'hadir' | 'tidak_hadir' | 'izin'; catatan?: string | null }[],
) => call<{ recorded: number }>(`/api/ojt/batches/${batchId}/absensi`, { ...auth(token, { entries }), method: 'POST' });

export const setOjtMateriDone = (token: string, batchId: number, pesertaId: number, materiId: number, selesai: boolean) =>
  call<{ selesai: boolean }>(`/api/ojt/batches/${batchId}/materi`, {
    ...auth(token, { pesertaId, materiId, selesai }),
    method: 'POST',
  });

export const createOjtQr = (token: string, batchId: number, purpose: 'pre_test' | 'post_test' | 'feedback' | 'attendance') =>
  call<{ token: string; url: string }>(`/api/assessment/events/${batchId}/qr`, {
    ...auth(token, { purpose }),
    method: 'POST',
  });