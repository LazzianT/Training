import type {
  AddOjtPesertaRequest,
  CreateOjtBatchRequest,
  CreateOjtJadwalRequest,
  CreateOjtMateriRequest,
  OjtAssessmentSummary,
  OjtBatch,
  OjtMateriMaster,
  OjtMateriTestSet,
  OjtBatchDetail,
  OjtBatchStatus,
  OjtQuestionInput,
  OjtResults,
  OjtSavedQuestion,
  UpdateOjtJadwalRequest,
  UpdateOjtMateriRequest,
} from '@training/contracts';
import { call } from './transport.js';

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

export const fetchOjtMateriMaster = (token: string, signal?: AbortSignal) =>
  call<OjtMateriMaster[]>(`/api/ojt/admin/materi/master`, { ...admin(token), signal });

export const createOjtMateri = (token: string, body: CreateOjtMateriRequest) =>
  call<{ id: number }>(`/api/ojt/admin/materi/master`, {
    ...admin(token, body),
    method: 'POST',
  });

export const updateOjtMateri = (token: string, materiId: number, body: UpdateOjtMateriRequest) =>
  call<{ id: number }>(`/api/ojt/admin/materi/master/${materiId}`, {
    ...admin(token, body),
    method: 'PATCH',
  });

/** Deactivates or reactivates. Removal is never a delete. */
export const setOjtMateriAktif = (token: string, materiId: number, aktif: boolean) =>
  call<{ id: number; aktif: boolean }>(`/api/ojt/admin/materi/master/${materiId}/aktif`, {
    ...admin(token, { aktif }),
    method: 'PATCH',
  });

export const moveOjtMateri = (token: string, materiId: number, direction: 1 | -1) =>
  call<{ id: number; moved: boolean }>(`/api/ojt/admin/materi/master/${materiId}/move`, {
    ...admin(token, { direction }),
    method: 'POST',
  });

/* ------------------------------------------------------------- assessment per materi */

/**
 * One QR per material per purpose. Revokes the previous code for the same
 * combination, so only the newest one is live.
 */
export const createOjtMateriQr = (
  token: string,
  batchId: number,
  materiId: number,
  purpose: 'pre_test' | 'post_test' | 'feedback' | 'attendance',
) =>
  call<{ token: string; url: string; materiId: number; purpose: string }>(
    `/api/ojt/admin/batches/${batchId}/materi/${materiId}/qr`,
    { ...admin(token, { purpose }), method: 'POST' },
  );

export const fetchOjtAssessment = (token: string, batchId: number, signal?: AbortSignal) =>
  call<OjtAssessmentSummary[]>(`/api/ojt/admin/batches/${batchId}/assessment`, {
    ...admin(token),
    signal,
  });

/**
 * Retires every live code for one material and purpose.
 *
 * Issuing a code no longer does this on its own, and that reversal is the point:
 * it used to mean a printed code died the next time somebody opened the dialog. A
 * scan needs only one live code to resolve, so the cost is that several can
 * coexist until this is called.
 */
export const revokeOjtMateriQr = (
  token: string,
  batchId: number,
  materiId: number,
  purpose: 'pre_test' | 'post_test' | 'feedback' | 'attendance',
) =>
  call<{ revoked: number }>(
    `/api/ojt/admin/batches/${batchId}/materi/${materiId}/qr?purpose=${encodeURIComponent(purpose)}`,
    { ...admin(token), method: 'DELETE' },
  );

export const fetchOjtMateriTestSet = (token: string, materiId: number, signal?: AbortSignal) =>
  call<OjtMateriTestSet>(`/api/ojt/admin/materi/${materiId}/test-set`, { ...admin(token), signal });

/** An ensure, not a create: returns the existing bank when there already is one. */
export const ensureOjtMateriTestSet = (token: string, materiId: number) =>
  call<OjtMateriTestSet>(`/api/ojt/admin/materi/${materiId}/test-set`, {
    ...admin(token),
    method: 'POST',
  });

export const unpublishOjtTestSet = (token: string, testSetId: number) =>
  call<{ status: 'draft' }>(`/api/ojt/admin/test-sets/${testSetId}/unpublish`, {
    ...admin(token),
    method: 'POST',
  });

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
