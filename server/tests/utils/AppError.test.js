const AppError = require('../../src/utils/AppError');

describe('AppError', () => {
  it('stores statusCode, code, message, and details', () => {
    const err = new AppError(404, 'NOT_FOUND', 'No encontrado', [{ field: 'id', message: 'required' }]);
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('No encontrado');
    expect(err.details).toEqual([{ field: 'id', message: 'required' }]);
  });

  it('defaults details to an empty array', () => {
    const err = new AppError(500, 'INTERNAL_ERROR', 'Error interno');
    expect(err.details).toEqual([]);
  });
});
