import { verifyAccessToken } from '../modules/auth/token.service.js';

const unauthorized = (response, code, message) => {
  response.status(401).json({ error: { code, message, requestId: response.locals.requestId } });
};

export const authenticate = (request, response, next) => {
  const header = request.header('authorization') ?? '';
  if (!header.startsWith('Bearer ')) {
    unauthorized(response, 'UNAUTHENTICATED', 'Sesi tidak ditemukan. Masuk kembali.');
    return;
  }

  try {
    const claims = verifyAccessToken(header.slice('Bearer '.length));
    if (claims.type !== 'access') throw new Error('wrong token type');
    response.locals.actor = {
      nip: claims.sub,
      role: claims.role,
      departId: claims.departId,
      isEventTrainer: claims.isEventTrainer,
      isCoordinator: claims.isCoordinator,
      sessionId: claims.sessionId,
    };
    next();
  } catch {
    unauthorized(response, 'TOKEN_EXPIRED', 'Sesi berakhir. Masuk kembali.');
  }
};
