const { signToken, verifyToken } = require('../../src/utils/jwt');

describe('jwt utils', () => {
  it('signs and verifies a token round-trip', () => {
    const token = signToken('user-123');
    const payload = verifyToken(token);
    expect(payload.sub).toBe('user-123');
  });

  it('throws when verifying an invalid token', () => {
    expect(() => verifyToken('not-a-real-token')).toThrow();
  });
});
