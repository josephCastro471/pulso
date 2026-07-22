import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import { useAppointments } from '../../contexts/AppointmentsContext';
import { useNotification } from '../../contexts/NotificationContext';

function toDatetimeLocalValue(date) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function nowForInput() {
  return toDatetimeLocalValue(new Date());
}

export default function AppointmentFormModal({ open, onClose, editItem = null }) {
  const { addAppointment, updateAppointment } = useAppointments();
  const { notifyError } = useNotification();
  const [doctor, setDoctor] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [datetime, setDatetime] = useState(nowForInput);
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editItem) {
      setDoctor(editItem.doctor);
      setSpecialty(editItem.specialty);
      setDatetime(toDatetimeLocalValue(editItem.datetime));
      setLocation(editItem.location);
    } else {
      setDoctor('');
      setSpecialty('');
      setDatetime(nowForInput());
      setLocation('');
    }
  }, [open, editItem]);

  const isValid =
    doctor.trim().length > 0 &&
    specialty.trim().length > 0 &&
    datetime.length > 0 &&
    location.trim().length > 0;

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const payload = {
        doctor: doctor.trim(),
        specialty: specialty.trim(),
        datetime: new Date(datetime).toISOString(),
        location: location.trim(),
      };
      if (editItem) {
        await updateAppointment(editItem.id, payload);
      } else {
        await addAppointment(payload);
      }
      onClose();
    } catch (err) {
      notifyError(err.message || 'No se pudo guardar la cita');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editItem ? 'Editar cita' : 'Registrar cita'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
        <TextField label="Doctor" value={doctor} onChange={(e) => setDoctor(e.target.value)} fullWidth required />
        <TextField label="Especialidad" value={specialty} onChange={(e) => setSpecialty(e.target.value)} fullWidth required />
        <TextField
          label="Fecha y hora"
          type="datetime-local"
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          fullWidth
          required
        />
        <TextField label="Ubicación" value={location} onChange={(e) => setLocation(e.target.value)} fullWidth required />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} variant="contained" disabled={!isValid || saving}>
          {saving ? 'Guardando...' : editItem ? 'Guardar cambios' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
