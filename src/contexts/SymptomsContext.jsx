import { createContext, useContext, useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

const STORAGE_KEY = 'pulso.symptoms';

function createId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function daysAgoISO(daysAgo, hour) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function seedSymptoms() {
  return [
    { id: createId(), datetime: daysAgoISO(6, 9), description: 'Dolor de cabeza leve', intensity: 2 },
    { id: createId(), datetime: daysAgoISO(5, 14), description: 'Náuseas después de comer', intensity: 3 },
    { id: createId(), datetime: daysAgoISO(3, 8), description: 'Fatiga general', intensity: 4 },
    { id: createId(), datetime: daysAgoISO(2, 20), description: 'Dolor articular', intensity: 3 },
    { id: createId(), datetime: daysAgoISO(1, 11), description: 'Mareo leve', intensity: 2 },
    { id: createId(), datetime: daysAgoISO(0, 7), description: 'Dolor de cabeza intenso', intensity: 5 },
  ];
}

function computeLast7Days(symptoms) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '');
    days.push({ date: key, label, intensities: [] });
  }
  const byKey = Object.fromEntries(days.map((d) => [d.date, d]));
  symptoms.forEach((s) => {
    const key = s.datetime.slice(0, 10);
    if (byKey[key]) byKey[key].intensities.push(s.intensity);
  });
  return days.map(({ date, label, intensities }) => ({
    date,
    label,
    avgIntensity: intensities.length
      ? intensities.reduce((a, b) => a + b, 0) / intensities.length
      : null,
  }));
}

const SymptomsContext = createContext(null);

export function SymptomsProvider({ children }) {
  const [symptoms, setSymptoms] = useLocalStorage(STORAGE_KEY, seedSymptoms);

  const addSymptom = (entry) => {
    setSymptoms((prev) => [...prev, { id: createId(), ...entry }]);
  };

  const last7Days = useMemo(() => computeLast7Days(symptoms), [symptoms]);

  const value = useMemo(() => ({ symptoms, addSymptom, last7Days }), [symptoms, last7Days]);

  return <SymptomsContext.Provider value={value}>{children}</SymptomsContext.Provider>;
}

export function useSymptoms() {
  const ctx = useContext(SymptomsContext);
  if (!ctx) throw new Error('useSymptoms debe usarse dentro de SymptomsProvider');
  return ctx;
}
