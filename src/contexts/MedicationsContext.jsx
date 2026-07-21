import { createContext, useContext, useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

const STORAGE_KEY = 'pulso.medications';

function createId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function seedMedications() {
  return [
    { id: createId(), name: 'Losartán', dose: '50mg', time: '08:00', takenDates: [] },
    { id: createId(), name: 'Metformina', dose: '850mg', time: '13:00', takenDates: [] },
    { id: createId(), name: 'Atorvastatina', dose: '20mg', time: '21:00', takenDates: [] },
  ];
}

const MedicationsContext = createContext(null);

export function MedicationsProvider({ children }) {
  const [medications, setMedications] = useLocalStorage(STORAGE_KEY, seedMedications);

  const toggleTaken = (id, date) => {
    setMedications((prev) =>
      prev.map((med) => {
        if (med.id !== id) return med;
        const taken = med.takenDates.includes(date);
        return {
          ...med,
          takenDates: taken ? med.takenDates.filter((d) => d !== date) : [...med.takenDates, date],
        };
      })
    );
  };

  const todayAdherence = useMemo(() => {
    if (medications.length === 0) return null;
    const today = todayKey();
    const takenCount = medications.filter((med) => med.takenDates.includes(today)).length;
    return Math.round((takenCount / medications.length) * 100);
  }, [medications]);

  const value = useMemo(
    () => ({ medications, toggleTaken, todayAdherence }),
    [medications, todayAdherence]
  );

  return <MedicationsContext.Provider value={value}>{children}</MedicationsContext.Provider>;
}

export function useMedications() {
  const ctx = useContext(MedicationsContext);
  if (!ctx) throw new Error('useMedications debe usarse dentro de MedicationsProvider');
  return ctx;
}
