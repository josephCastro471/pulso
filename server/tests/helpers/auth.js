const request = require('supertest');

async function createUserAndToken(app, overrides = {}) {
  const payload = {
    name: 'Test User',
    email: `user-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
    password: 'password123',
    ...overrides,
  };
  const response = await request(app).post('/api/auth/register').send(payload);
  return { token: response.body.token, user: response.body.user };
}

module.exports = { createUserAndToken };
