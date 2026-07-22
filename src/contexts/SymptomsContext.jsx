import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getSymptoms, createSymptom } from '../api/symptoms';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';

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
  const { isAuthenticated } = useAuth();
  const { notifyError } = useNotification();
  const [symptoms, setSymptoms] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setSymptoms([]);
      return;
    }

    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    setLoading(true);
    getSymptoms({ from, to, limit: 100 })
      .then((res) => setSymptoms(res.data))
      .catch((err) => notifyError(err.message || 'No se pudieron cargar los síntomas'))
      .finally(() => setLoading(false));
  }, [isAuthenticated, notifyError]);

  const addSymptom = async (entry) => {
    const created = await createSymptom(entry);
    setSymptoms((prev) => [created, ...prev]);
    return created;
  };

  const last7Days = useMemo(() => computeLast7Days(symptoms), [symptoms]);

  const value = useMemo(
    () => ({ symptoms, addSymptom, last7Days, loading }),
    [symptoms, last7Days, loading]
  );

  return <SymptomsContext.Provider value={value}>{children}</SymptomsContext.Provider>;
}

export function useSymptoms() {
  const ctx = useContext(SymptomsContext);
  if (!ctx) throw new Error('useSymptoms debe usarse dentro de SymptomsProvider');
  return ctx;
}
