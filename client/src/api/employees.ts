import type { EmployeeLite } from '@training/contracts';
import { apiBaseUrl, ApiRequestError } from './auth.js';

export const searchEmployees = async (token: string, q: string, signal?: AbortSignal): Promise<EmployeeLite[]> => {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/api/employees?q=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${token}` }, signal,
    });
  } catch {
    throw new ApiRequestError('NETWORK_ERROR', 'Tidak dapat menghubungi server', 0);
  }
  if (response.status === 401) throw new ApiRequestError('TOKEN_EXPIRED', 'Sesi berakhir. Masuk kembali.', 401);
  if (!response.ok) throw new ApiRequestError('EMPLOYEE_SEARCH_FAILED', 'Gagal mencari karyawan.', response.status);
  return response.json() as Promise<EmployeeLite[]>;
};

export const suggestEmployeesForTraining = async (token: string, title: string, q: string, signal?: AbortSignal): Promise<EmployeeLite[]> => {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/api/employees/suggestions?title=${encodeURIComponent(title)}&q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${token}` }, signal });
  } catch {
    throw new ApiRequestError('NETWORK_ERROR', 'Tidak dapat menghubungi server', 0);
  }
  if (response.status === 401) throw new ApiRequestError('TOKEN_EXPIRED', 'Sesi berakhir. Masuk kembali.', 401);
  if (!response.ok) throw new ApiRequestError('EMPLOYEE_SUGGESTION_FAILED', 'Gagal memuat rekomendasi karyawan.', response.status);
  return response.json() as Promise<EmployeeLite[]>;
};
