import { Router } from 'express';
import { z } from 'zod';
import { LoginError, login } from './login.service.js';

const loginBody = z.object({
  nip: z.string().trim().min(1).max(50),
  credential: z.string().min(1).max(200),
});

const STATUS = {
  INVALID_CREDENTIAL: 401,
  BIRTH_DATE_INVALID: 400,
};

const fail = (response, status, code, message) => {
  response.status(status).json({ error: { code, message, requestId: response.locals.requestId } });
};

export const authRouter = Router();

authRouter.post('/login', async (request, response, next) => {
  const parsed = loginBody.safeParse(request.body);
  if (!parsed.success) {
    fail(response, 400, 'VALIDATION_ERROR', 'Nomor Induk Karyawan dan credential wajib diisi');
    return;
  }

  try {
    response.status(200).json(await login(parsed.data.nip, parsed.data.credential));
  } catch (error) {
    if (error instanceof LoginError) {
      fail(response, STATUS[error.code] ?? 500, error.code, error.message);
      return;
    }
    next(error);
  }
});
