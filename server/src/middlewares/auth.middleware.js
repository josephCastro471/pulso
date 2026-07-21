const { verifyToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Token de autenticación requerido'));
  }

  const token = header.slice('Bearer '.length);
  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub };
    next();
  } catch {
    next(new AppError(401, 'UNAUTHORIZED', 'Token inválido o expirado'));
  }
}

module.exports = authMiddleware;
