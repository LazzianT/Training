import { randomUUID } from 'node:crypto';
import { logger } from '../../logger.js';
import { parseBirthDate } from './birth-date.js';
import { findEmployeeByNipAndBirthDate } from './employee.repository.js';
import { accessTokenTtlSeconds, signAccessToken } from './token.service.js';

export const LoginError = class LoginError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'LoginError';
    this.code = code;
  }
};

/**
 * One path, straight against HR: the birth date is checked against
 * hris_Employee and never stored anywhere by this service.
 */
export const login = async (nip, credential) => {
  const parsed = parseBirthDate(credential);
  if (!parsed.ok) {
    throw new LoginError(
      'BIRTH_DATE_INVALID',
      'Tanggal lahir harus 6 digit format DDMMYY, contoh 120390',
    );
  }

  const employee = await findEmployeeByNipAndBirthDate(nip, parsed.candidates);
  if (!employee) {
    logger.warn({ nip }, 'HR verification failed');
    throw new LoginError('INVALID_CREDENTIAL', 'Nomor Induk Karyawan atau tanggal lahir salah');
  }

  logger.info({ nip }, 'Login verified against HR');
  const isCoordinator = employee.departId === '0300' || /(^|[^a-z])hc([^a-z]|$)/i.test(employee.departmentName ?? '');
  return {
    accessToken: signAccessToken({
      sub: employee.nip,
      role: 'employee',
      departId: employee.departId,
      isEventTrainer: employee.isEventTrainer,
      isCoordinator,
      sessionId: randomUUID(),
      type: 'access',
    }),
    expiresInSeconds: accessTokenTtlSeconds(),
    employee,
  };
};
