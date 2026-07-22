import client from './client';

export async function getMedications(params = {}) {
  const { data } = await client.get('/medications', { params });
  return data;
}

export async function getMedicationLogs(id, params = {}) {
  const { data } = await client.get(`/medications/${id}/logs`, { params });
  return data;
}

export async function upsertMedicationLog(id, payload) {
  const { data } = await client.post(`/medications/${id}/logs`, payload);
  return data;
}

export async function createMedication(payload) {
  const { data } = await client.post('/medications', payload);
  return data;
}
