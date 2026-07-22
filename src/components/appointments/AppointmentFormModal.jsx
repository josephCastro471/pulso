import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import { useAppointments } from '../../contexts/AppointmentsContext';
import { useNotification } from '../../contexts/NotificationContext';

function nowForInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function AppointmentFormModal({ open, onClose }) {
  const { addAppointment } = useAppointments();
  const { notifyError } = useNotification();
  const [doctor, setDoctor] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [datetime, setDatetime] = useState(nowForInput);
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  const isValid =
    doctor.trim().length > 0 &&
    specialty.trim().length > 0 &&
    datetime.length > 0 &&
    location.trim().length > 0;

  const handleClose = () => {
    setDoctor('');
    setSpecialty('');
    setDatetime(nowForInput());
    setLocation('');
    onClose();
  };

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      await addAppointment({
        doctor: doctor.trim(),
        specialty: specialty.trim(),
        datetime: new Date(datetime).toISOString(),
        location: location.trim(),
      });
      handleClose();
    } catch (err) {
      notifyError(err.message || 'No se pudo guardar la cita');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Registrar cita</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
        <TextField
          label="Doctor"
          value={doctor}
          onChange={(e) => setDoctor(e.target.value)}
          fullWidth
          required
        />
        <TextField
          label="Especialidad"
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          fullWidth
          required
        />
        <TextField
          label="Fecha y hora"
          type="datetime-local"
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          fullWidth
          required
        />
        <TextField
          label="Ubicación"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          fullWidth
          required
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancelar</Button>
        <Button onClick={handleSave} variant="contained" disabled={!isValid || saving}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
