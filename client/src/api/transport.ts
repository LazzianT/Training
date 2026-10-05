import type { ApiError } from '@training/contracts';
import { apiBaseUrl, ApiRequestError } from './auth.js';

type FieldErrors = Record<string, string[] | undefined> & { _root?: string[] };

/**
 * The one place a request leaves the client and a failure comes back as an
 * ApiRequestError.
 *
 * Shared so the admin surfaces, the public QR routes and the certificate calls all
 * report failures the same way. `anonymous` exists because the participant routes
 * are reached without a session, and turning their 401 into "session expired" sent
 * people looking for a login they never had.
 */
export const call = async <T>(path: string, init: RequestInit = {}, anonymous = false): Promise<T> => {
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
      body?.error?.code ?? 'UNKNOWN_ERROR',
      body?.error?.message ?? 'Permintaan gagal.',
      response.status,
      body?.error?.details,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
};
