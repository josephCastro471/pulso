import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { registerErrorNotifier } from '../api/client';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'error' });

  const notify = useCallback((message, severity) => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const notifyError = useCallback((message) => notify(message, 'error'), [notify]);
  const notifySuccess = useCallback((message) => notify(message, 'success'), [notify]);

  useEffect(() => {
    registerErrorNotifier(notifyError);
  }, [notifyError]);

  const handleClose = (_event, reason) => {
    if (reason === 'clickaway') return;
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const value = useMemo(() => ({ notifyError, notifySuccess }), [notifyError, notifySuccess]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={handleClose}>
        <Alert onClose={handleClose} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification debe usarse dentro de NotificationProvider');
  return ctx;
}
