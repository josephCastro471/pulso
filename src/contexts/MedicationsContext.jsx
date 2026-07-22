import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  getMedications,
  getMedicationLogs,
  upsertMedicationLog,
  createMedication,
  updateMedication as updateMedicationApi,
  deleteMedication as deleteMedicationApi,
} from '../api/medications';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

const MedicationsContext = createContext(null);

export function MedicationsProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const { notifyError } = useNotification();
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setMedications([]);
      return;
    }
    let ignore = false;

    const today = todayKey();
    setLoading(true);
    getMedications({ limit: 100 })
      .then(async (res) => {
        const withLogs = await Promise.all(
          res.data.map(async (med) => {
            const logsRes = await getMedicationLogs(med.id, { from: today, to: today });
            const takenToday = logsRes.data.some((log) => log.date.slice(0, 10) === today && log.taken);
            return { ...med, takenToday };
          })
        );
        if (!ignore) setMedications(withLogs);
      })
      .catch((err) => { if (!ignore) notifyError(err.message || 'No se pudieron cargar los medicamentos'); })
      .finally(() => { if (!ignore) setLoading(false); });

    return () => { ignore = true; };
  }, [isAuthenticated, notifyError]);

  const toggleTaken = async (id) => {
    const med = medications.find((m) => m.id === id);
    if (!med) return;

    try {
      const log = await upsertMedicationLog(id, { date: todayKey(), taken: !med.takenToday });
      setMedications((prev) => prev.map((m) => (m.id === id ? { ...m, takenToday: log.taken } : m)));
    } catch (err) {
      notifyError(err.message || 'No se pudo actualizar el medicamento');
    }
  };

  const addMedication = async (data) => {
    const created = await createMedication(data);
    setMedications((prev) => [...prev, { ...created, takenToday: false }]);
  };

  const updateMedication = async (id, data) => {
    const updated = await updateMedicationApi(id, data);
    setMedications((prev) =>
      prev.map((m) => (m.id === id ? { ...updated, takenToday: m.takenToday } : m))
    );
    return updated;
  };

  const removeMedication = async (id) => {
    await deleteMedicationApi(id);
    setMedications((prev) => prev.filter((m) => m.id !== id));
  };

  const todayAdherence = useMemo(() => {
    if (medications.length === 0) return null;
    const takenCount = medications.filter((med) => med.takenToday).length;
    return Math.round((takenCount / medications.length) * 100);
  }, [medications]);

  const value = useMemo(
    () => ({
      medications,
      toggleTaken,
      addMedication,
      updateMedication,
      removeMedication,
      todayAdherence,
      loading,
    }),
    [medications, todayAdherence, loading]
  );

  return <MedicationsContext.Provider value={value}>{children}</MedicationsContext.Provider>;
}

export function useMedications() {
  const ctx = useContext(MedicationsContext);
  if (!ctx) throw new Error('useMedications debe usarse dentro de MedicationsProvider');
  return ctx;
}
