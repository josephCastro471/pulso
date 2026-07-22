import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getAppointments, createAppointment } from '../api/appointments';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';

const AppointmentsContext = createContext(null);

export function AppointmentsProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const { notifyError } = useNotification();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setAppointments([]);
      return;
    }

    setLoading(true);
    getAppointments()
      .then((res) => setAppointments(res.data))
      .catch((err) => notifyError(err.message || 'No se pudieron cargar las citas'))
      .finally(() => setLoading(false));
  }, [isAuthenticated, notifyError]);

  const nextAppointment = useMemo(() => {
    const now = Date.now();
    const future = appointments
      .filter((a) => new Date(a.datetime).getTime() >= now)
      .sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
    return future.length > 0 ? future[0] : null;
  }, [appointments]);

  const addAppointment = async (data) => {
    const created = await createAppointment(data);
    setAppointments((prev) => [...prev, created]);
  };

  const value = useMemo(
    () => ({ appointments, nextAppointment, addAppointment, loading }),
    [appointments, nextAppointment, loading]
  );

  return <AppointmentsContext.Provider value={value}>{children}</AppointmentsContext.Provider>;
}

export function useAppointments() {
  const ctx = useContext(AppointmentsContext);
  if (!ctx) throw new Error('useAppointments debe usarse dentro de AppointmentsProvider');
  return ctx;
}
