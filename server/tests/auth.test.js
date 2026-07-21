const request = require('supertest');
const app = require('./helpers/app');

describe('POST /api/auth/register', () => {
  it('registers a new user and returns a token', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'supersecret123',
    });

    expect(response.status).toBe(201);
    expect(response.body.user).toEqual({ id: expect.any(String), name: 'Ada Lovelace', email: 'ada@example.com' });
    expect(typeof response.body.token).toBe('string');
  });

  it('rejects a duplicate email with 409', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Ada Lovelace',
      email: 'dup@example.com',
      password: 'supersecret123',
    });

    const response = await request(app).post('/api/auth/register').send({
      name: 'Another Name',
      email: 'dup@example.com',
      password: 'supersecret123',
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('rejects invalid input with 400', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: '',
      email: 'not-an-email',
      password: '123',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.length).toBeGreaterThan(0);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Grace Hopper',
      email: 'grace@example.com',
      password: 'supersecret123',
    });

    const response = await request(app).post('/api/auth/login').send({
      email: 'grace@example.com',
      password: 'supersecret123',
    });

    expect(response.status).toBe(200);
    expect(typeof response.body.token).toBe('string');
    expect(response.body.user.email).toBe('grace@example.com');
  });

  it('rejects wrong password with 401', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Grace Hopper',
      email: 'grace2@example.com',
      password: 'supersecret123',
    });

    const response = await request(app).post('/api/auth/login').send({
      email: 'grace2@example.com',
      password: 'wrongpassword',
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects an unknown email with 401', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: 'whatever123',
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user when authenticated', async () => {
    const registerResponse = await request(app).post('/api/auth/register').send({
      name: 'Margaret Hamilton',
      email: 'margaret@example.com',
      password: 'supersecret123',
    });

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${registerResponse.body.token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: expect.any(String), name: 'Margaret Hamilton', email: 'margaret@example.com' });
  });

  it('rejects requests without a token with 401', async () => {
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects requests with a malformed token with 401', async () => {
    const response = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
