import type { ApiError, DashboardSummary } from '@training/contracts';
import { apiBaseUrl, ApiRequestError } from './auth.js';

export const fetchSummary = async (
  accessToken: string,
  year: number,
  month: number,
  signal?: AbortSignal,
): Promise<DashboardSummary> => {
  let response: Response;
  try {
    response = await fetch(
      `${apiBaseUrl}/api/dashboard/summary?year=${year}&month=${month}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, signal },
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiRequestError('NETWORK_ERROR', 'Tidak dapat menghubungi server', 0);
  }

  if (response.status === 401) {
    throw new ApiRequestError('TOKEN_EXPIRED', 'Sesi berakhir. Masuk kembali.', 401);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(
      body?.error.code ?? 'UNKNOWN_ERROR',
      body?.error.message ?? 'Ringkasan gagal dimuat.',
      response.status,
    );
  }

  return (await response.json()) as DashboardSummary;
};
