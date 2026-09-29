import type {
  ApiError,
  CreateEventRequest,
  EventSummary,
  EventDetail,
  Room,
} from '@training/contracts';
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
    const body = (await response.json().catch(() => null)) as (ApiError & { error: { details?: FieldErrors } }) | null;
    throw new ApiRequestError(
      body?.error.code ?? 'UNKNOWN_ERROR',
      body?.error.message ?? 'Permintaan gagal.',
      response.status,
      body?.error.details,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
};

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` });

export const fetchRooms = (token: string, signal?: AbortSignal) =>
  call<Room[]>('/api/events/rooms', { headers: authHeaders(token), signal });

export const fetchEvents = (token: string, year: number, month: number, signal?: AbortSignal) =>
  call<EventSummary[]>(`/api/events?year=${year}&month=${month}`, { headers: authHeaders(token), signal });

export const fetchMyEvents = (token: string, signal?: AbortSignal) =>
  call<EventSummary[]>('/api/events/my', { headers: authHeaders(token), signal });

export const createEvent = (token: string, body: CreateEventRequest) =>
  call<{ id: number }>('/api/events', {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export const fetchEvent = (token: string, id: number) =>
  call<EventDetail>(`/api/events/${id}`, { headers: authHeaders(token) });

export const updateEvent = (token: string, id: number, body: CreateEventRequest) =>
  call<void>(`/api/events/${id}`, {
    method: 'PUT', headers: { ...authHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });

export const addParticipants = (token: string, id: number, nips: string[]) =>
  call<{ added: number; skipped: number }>(`/api/events/${id}/peserta`, {
    method: 'POST', headers: { ...authHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify({ nips }),
  });

export const removeParticipant = (token: string, eventId: number, nip: string) =>
  call<void>(`/api/events/${eventId}/peserta/${encodeURIComponent(nip)}`, {
    method: 'DELETE', headers: authHeaders(token),
  });

export type QrAccess = { id: string; purpose: 'pre_test' | 'post_test' | 'feedback' | 'attendance'; expiresAt: string; usedCount: number; maxUses: number };

export const fetchEventQr = (token: string, eventId: number) =>
  call<QrAccess[]>(`/api/assessment/events/${eventId}/qr`, { headers: authHeaders(token) });

export const createEventQr = (token: string, eventId: number, purpose: QrAccess['purpose']) =>
  call<QrAccess & { token: string; url: string }>(`/api/assessment/events/${eventId}/qr`, {
    method: 'POST', headers: { ...authHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify({ purpose }),
  });

export type TestSet = { id: number; type: 'pg' | 'essay' | 'mixed'; questionCount: number; status: string };

export const createTestSet = (token: string, eventId: number, type: TestSet['type']) =>
  call<TestSet>(`/api/assessment/events/${eventId}/tests`, {
    method: 'POST', headers: { ...authHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify({ type }),
  });

export const fetchTestSets = (token: string, eventId: number) =>
  call<TestSet[]>(`/api/assessment/events/${eventId}/tests`, { headers: authHeaders(token) });

export const addTestQuestion = (token: string, testSetId: number, body: { type: 'pg' | 'essay'; text: string; a?: string; b?: string; c?: string; d?: string; correct?: string; instructions?: string; answerGuide?: string; imageData?: string; point: number }) =>
  call<{ id: number }>(`/api/assessment/tests/${testSetId}/questions`, {
    method: 'POST', headers: { ...authHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });

export type SavedQuestion = { id: number; type: 'pg' | 'essay'; number: number; text: string };

export const fetchQuestions = (token: string, testSetId: number) =>
  call<SavedQuestion[]>(`/api/assessment/tests/${testSetId}/questions`, { headers: authHeaders(token) });

export const deleteQuestion = (token: string, testSetId: number, question: SavedQuestion) =>
  call<void>(`/api/assessment/tests/${testSetId}/questions/${question.type}/${question.id}`, { method: 'DELETE', headers: authHeaders(token) });

export type AssessmentResults = {
  submissions: { phase: string; nip: string; name: string | null; status: string; score: number; totalScore: number; percentage: number | null }[];
  questionStats: { phase: string; number: number; text: string; answered: number; wrong: number; wrongPercentage: number }[];
};

export const fetchAssessmentResults = (token: string, eventId: number) =>
  call<AssessmentResults>(`/api/assessment/events/${eventId}/results`, { headers: authHeaders(token) });

export const publishTestSet = (token: string, testSetId: number) =>
  call<void>(`/api/assessment/tests/${testSetId}/publish`, { method: 'POST', headers: authHeaders(token) });

export const deleteTestSet = (token: string, testSetId: number) =>
  call<void>(`/api/assessment/tests/${testSetId}`, { method: 'DELETE', headers: authHeaders(token) });
