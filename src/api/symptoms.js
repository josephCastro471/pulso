import client from './client';

export async function getSymptoms(params = {}) {
  const { data } = await client.get('/symptoms', { params });
  return data;
}

export async function createSymptom(payload) {
  const { data } = await client.post('/symptoms', payload);
  return data;
}
