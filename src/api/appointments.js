import client from './client';

export async function getAppointments(params = {}) {
  const { data } = await client.get('/appointments', { params });
  return data;
}

export async function createAppointment(payload) {
  const { data } = await client.post('/appointments', payload);
  return data;
}

export async function updateAppointment(id, payload) {
  const { data } = await client.put(`/appointments/${id}`, payload);
  return data;
}

export async function deleteAppointment(id) {
  await client.delete(`/appointments/${id}`);
}
