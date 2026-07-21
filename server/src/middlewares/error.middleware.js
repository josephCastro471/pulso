const AppError = require('../utils/AppError');

function errorMiddleware(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { message: err.message, code: err.code, details: err.details },
    });
  }

  if (process.env.NODE_ENV !== 'test') {
    console.error(err);
  }

  return res.status(500).json({
    error: { message: 'Internal server error', code: 'INTERNAL_ERROR', details: [] },
  });
}

module.exports = errorMiddleware;
