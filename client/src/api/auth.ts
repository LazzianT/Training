import type { ApiError, LoginResponse } from '@training/contracts';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export class ApiRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: Record<string, string[] | undefined>,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export const loginRequest = async (nip: string, credential: string, signal?: AbortSignal) => {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nip, credential }),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiRequestError('NETWORK_ERROR', 'Tidak dapat menghubungi server', 0);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(
      body?.error.code ?? 'UNKNOWN_ERROR',
      body?.error.message ?? 'Terjadi kesalahan. Coba lagi.',
      response.status,
    );
  }

  return (await response.json()) as LoginResponse;
};

export const apiBaseUrl = API_BASE;
