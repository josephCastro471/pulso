import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import { useMedications } from '../../contexts/MedicationsContext';
import { useNotification } from '../../contexts/NotificationContext';

export default function MedicationFormModal({ open, onClose }) {
  const { addMedication } = useMedications();
  const { notifyError } = useNotification();
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [saving, setSaving] = useState(false);

  const isValid = name.trim().length > 0 && dosage.trim().length > 0 && frequency.trim().length > 0;

  const handleClose = () => {
    setName('');
    setDosage('');
    setFrequency('');
    onClose();
  };

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      await addMedication({
        name: name.trim(),
        dosage: dosage.trim(),
        frequency: frequency.trim(),
      });
      handleClose();
    } catch (err) {
      notifyError(err.message || 'No se pudo guardar el medicamento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Registrar medicamento</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
        <TextField
          label="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          required
        />
        <TextField
          label="Dosis"
          value={dosage}
          onChange={(e) => setDosage(e.target.value)}
          placeholder="50mg"
          fullWidth
          required
        />
        <TextField
          label="Frecuencia"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          placeholder="Cada 8 horas"
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
