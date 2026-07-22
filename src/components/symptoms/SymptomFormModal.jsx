import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { useSymptoms } from '../../contexts/SymptomsContext';
import { useNotification } from '../../contexts/NotificationContext';

function toDatetimeLocalValue(date) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function nowForInput() {
  return toDatetimeLocalValue(new Date());
}

const marks = [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) }));
const intensityColors = { 1: '#3B8C5A', 2: '#8FB03E', 3: '#C6821F', 4: '#D85A30', 5: '#C0392B' };

export default function SymptomFormModal({ open, onClose, editItem = null }) {
  const { addSymptom, updateSymptom } = useSymptoms();
  const { notifyError } = useNotification();
  const [datetime, setDatetime] = useState(nowForInput);
  const [description, setDescription] = useState('');
  const [intensity, setIntensity] = useState(3);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editItem) {
      setDatetime(toDatetimeLocalValue(editItem.datetime));
      setDescription(editItem.description);
      setIntensity(editItem.intensity);
    } else {
      setDatetime(nowForInput());
      setDescription('');
      setIntensity(3);
    }
  }, [open, editItem]);

  const isValid = description.trim().length > 0 && datetime.length > 0;

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const payload = {
        datetime: new Date(datetime).toISOString(),
        description: description.trim(),
        intensity,
      };
      if (editItem) {
        await updateSymptom(editItem.id, payload);
      } else {
        await addSymptom(payload);
      }
      onClose();
    } catch (err) {
      notifyError(err.message || 'No se pudo guardar el síntoma');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editItem ? 'Editar síntoma' : 'Registrar síntoma'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
        <TextField
          label="Fecha y hora"
          type="datetime-local"
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          fullWidth
        />
        <TextField
          label="Descripción"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          multiline
          minRows={3}
          fullWidth
          required
        />
        <Box>
          <Typography gutterBottom color="text.secondary">
            Intensidad
          </Typography>
          <Slider
            value={intensity}
            onChange={(_, value) => setIntensity(value)}
            step={1}
            min={1}
            max={5}
            marks={marks}
            sx={{ color: intensityColors[intensity] }}
          />
        </Box>
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
