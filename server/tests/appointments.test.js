const request = require('supertest');
const app = require('./helpers/app');
const { createUserAndToken } = require('./helpers/auth');

describe('Appointments API', () => {
  it('creates and lists an appointment', async () => {
    const { token } = await createUserAndToken(app);

    const createResponse = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        doctor: 'Dr. Pérez',
        specialty: 'Cardiología',
        datetime: new Date(Date.now() + 86400000).toISOString(),
        location: 'Clínica Central',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.doctor).toBe('Dr. Pérez');

    const listResponse = await request(app)
      .get('/api/appointments')
      .set('Authorization', `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);
    expect(listResponse.body.pagination).toEqual({ page: 1, limit: 20, total: 1 });
  });

  it('rejects invalid input with 400', async () => {
    const { token } = await createUserAndToken(app);

    const response = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({ doctor: '', specialty: '', datetime: 'not-a-date', location: '' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unauthenticated requests with 401', async () => {
    const response = await request(app).get('/api/appointments');
    expect(response.status).toBe(401);
  });

  it("returns 404 when accessing another user's appointment", async () => {
    const owner = await createUserAndToken(app);
    const intruder = await createUserAndToken(app);

    const createResponse = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        doctor: 'Dr. Gómez',
        specialty: 'Dermatología',
        datetime: new Date(Date.now() + 86400000).toISOString(),
        location: 'Hospital Norte',
      });

    const response = await request(app)
      .put(`/api/appointments/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .send({ location: 'Hackeado' });

    expect(response.status).toBe(404);
  });

  it('updates and deletes an appointment', async () => {
    const { token } = await createUserAndToken(app);

    const createResponse = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        doctor: 'Dr. Ruiz',
        specialty: 'Neurología',
        datetime: new Date(Date.now() + 86400000).toISOString(),
        location: 'Clínica Sur',
      });

    const updateResponse = await request(app)
      .put(`/api/appointments/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ location: 'Clínica Norte' });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.location).toBe('Clínica Norte');

    const deleteResponse = await request(app)
      .delete(`/api/appointments/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteResponse.status).toBe(204);
  });
});
