import { createContext, useContext, useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

const STORAGE_KEY = 'pulso.appointments';

function createId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function daysFromNowISO(days, hour) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function seedAppointments() {
  return [
    {
      id: createId(),
      doctor: 'Dra. Elena Ruiz',
      specialty: 'Medicina general',
      datetime: daysFromNowISO(-5, 10),
      location: 'Clínica Central, consultorio 3',
    },
    {
      id: createId(),
      doctor: 'Dr. Marco Vidal',
      specialty: 'Cardiología',
      datetime: daysFromNowISO(9, 16),
      location: 'Centro Médico Norte, piso 2',
    },
  ];
}

const AppointmentsContext = createContext(null);

export function AppointmentsProvider({ children }) {
  const [appointments] = useLocalStorage(STORAGE_KEY, seedAppointments);

  const nextAppointment = useMemo(() => {
    const now = Date.now();
    const future = appointments
      .filter((a) => new Date(a.datetime).getTime() >= now)
      .sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
    return future.length > 0 ? future[0] : null;
  }, [appointments]);

  const value = useMemo(() => ({ appointments, nextAppointment }), [appointments, nextAppointment]);

  return <AppointmentsContext.Provider value={value}>{children}</AppointmentsContext.Provider>;
}

export function useAppointments() {
  const ctx = useContext(AppointmentsContext);
  if (!ctx) throw new Error('useAppointments debe usarse dentro de AppointmentsProvider');
  return ctx;
}
