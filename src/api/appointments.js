import client from './client';

export async function getAppointments(params = {}) {
  const { data } = await client.get('/appointments', { params });
  return data;
}

export async function createAppointment(payload) {
  const { data } = await client.post('/appointments', payload);
  return data;
}
