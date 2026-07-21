const request = require('supertest');
const app = require('./helpers/app');
const { createUserAndToken } = require('./helpers/auth');

describe('Medications API', () => {
  it('creates and lists a medication', async () => {
    const { token } = await createUserAndToken(app);

    const createResponse = await request(app)
      .post('/api/medications')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Losartán', dosage: '50mg', frequency: 'cada 24 horas' });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.name).toBe('Losartán');

    const listResponse = await request(app)
      .get('/api/medications')
      .set('Authorization', `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);
    expect(listResponse.body.pagination).toEqual({ page: 1, limit: 20, total: 1 });
  });

  it('rejects invalid input with 400', async () => {
    const { token } = await createUserAndToken(app);

    const response = await request(app)
      .post('/api/medications')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '', dosage: '', frequency: '' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unauthenticated requests with 401', async () => {
    const response = await request(app).get('/api/medications');
    expect(response.status).toBe(401);
  });

  it("returns 404 when accessing another user's medication", async () => {
    const owner = await createUserAndToken(app);
    const intruder = await createUserAndToken(app);

    const createResponse = await request(app)
      .post('/api/medications')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Metformina', dosage: '850mg', frequency: 'cada 12 horas' });

    const response = await request(app)
      .delete(`/api/medications/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${intruder.token}`);

    expect(response.status).toBe(404);
  });

  it('updates and deletes a medication', async () => {
    const { token } = await createUserAndToken(app);

    const createResponse = await request(app)
      .post('/api/medications')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Atorvastatina', dosage: '20mg', frequency: 'cada 24 horas' });

    const updateResponse = await request(app)
      .put(`/api/medications/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ dosage: '40mg' });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.dosage).toBe('40mg');

    const deleteResponse = await request(app)
      .delete(`/api/medications/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteResponse.status).toBe(204);
  });
});

describe('Medication logs', () => {
  it('upserts a medication log and lists history', async () => {
    const { token } = await createUserAndToken(app);

    const createResponse = await request(app)
      .post('/api/medications')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Atorvastatina', dosage: '20mg', frequency: 'cada 24 horas' });

    const medicationId = createResponse.body.id;

    const logResponse = await request(app)
      .post(`/api/medications/${medicationId}/logs`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-07-21', taken: true });

    expect(logResponse.status).toBe(200);
    expect(logResponse.body.taken).toBe(true);

    const toggleResponse = await request(app)
      .post(`/api/medications/${medicationId}/logs`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-07-21', taken: false });

    expect(toggleResponse.status).toBe(200);
    expect(toggleResponse.body.taken).toBe(false);
    expect(toggleResponse.body.id).toBe(logResponse.body.id);

    const historyResponse = await request(app)
      .get(`/api/medications/${medicationId}/logs`)
      .set('Authorization', `Bearer ${token}`);

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.data).toHaveLength(1);
  });

  it("returns 404 when logging another user's medication", async () => {
    const owner = await createUserAndToken(app);
    const intruder = await createUserAndToken(app);

    const createResponse = await request(app)
      .post('/api/medications')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Ibuprofeno', dosage: '400mg', frequency: 'cada 8 horas' });

    const response = await request(app)
      .post(`/api/medications/${createResponse.body.id}/logs`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .send({ date: '2026-07-21', taken: true });

    expect(response.status).toBe(404);
  });
});
