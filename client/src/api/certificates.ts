import type { IssuedCertificate, MyCertificate } from '@training/contracts';
import { call } from './transport.js';

const auth = (token: string): RequestInit => ({ headers: { Authorization: `Bearer ${token}` } });

/** Trainings the signed-in employee is registered for, with any certificate already issued. */
export const fetchMyCertificates = (token: string, signal?: AbortSignal) =>
  call<MyCertificate[]>('/api/certificates/mine', { ...auth(token), signal });

/**
 * Issues the certificate for one training.
 *
 * Called when the employee prints, not when the list loads, so the count of issued
 * certificates stays a count of ones really handed out rather than a count of who
 * opened a page. Idempotent on the server, so pressing print twice is harmless.
 */
export const issueMyCertificate = (token: string, eventId: number) =>
  call<IssuedCertificate>(`/api/certificates/mine/${eventId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
