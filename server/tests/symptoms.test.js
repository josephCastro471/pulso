const request = require('supertest');
const app = require('./helpers/app');
const { createUserAndToken } = require('./helpers/auth');

describe('Symptoms API', () => {
  it('creates and lists a symptom for the authenticated user', async () => {
    const { token } = await createUserAndToken(app);

    const createResponse = await request(app)
      .post('/api/symptoms')
      .set('Authorization', `Bearer ${token}`)
      .send({ datetime: new Date().toISOString(), description: 'Dolor de cabeza', intensity: 3 });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.description).toBe('Dolor de cabeza');

    const listResponse = await request(app)
      .get('/api/symptoms')
      .set('Authorization', `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);
    expect(listResponse.body.pagination).toEqual({ page: 1, limit: 20, total: 1 });
  });

  it('rejects invalid intensity with 400', async () => {
    const { token } = await createUserAndToken(app);

    const response = await request(app)
      .post('/api/symptoms')
      .set('Authorization', `Bearer ${token}`)
      .send({ datetime: new Date().toISOString(), description: 'Dolor', intensity: 9 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unauthenticated requests with 401', async () => {
    const response = await request(app).get('/api/symptoms');
    expect(response.status).toBe(401);
  });

  it("returns 404 when accessing another user's symptom", async () => {
    const owner = await createUserAndToken(app);
    const intruder = await createUserAndToken(app);

    const createResponse = await request(app)
      .post('/api/symptoms')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ datetime: new Date().toISOString(), description: 'Mareo', intensity: 2 });

    const response = await request(app)
      .get(`/api/symptoms/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${intruder.token}`);

    expect(response.status).toBe(404);
  });

  it('updates and deletes a symptom', async () => {
    const { token } = await createUserAndToken(app);

    const createResponse = await request(app)
      .post('/api/symptoms')
      .set('Authorization', `Bearer ${token}`)
      .send({ datetime: new Date().toISOString(), description: 'Fatiga', intensity: 4 });

    const updateResponse = await request(app)
      .put(`/api/symptoms/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ intensity: 2 });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.intensity).toBe(2);

    const deleteResponse = await request(app)
      .delete(`/api/symptoms/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteResponse.status).toBe(204);

    const getResponse = await request(app)
      .get(`/api/symptoms/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getResponse.status).toBe(404);
  });
});
