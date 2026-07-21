import { useState } from 'react';
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

function nowForInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const marks = [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) }));
const intensityColors = { 1: '#3B8C5A', 2: '#8FB03E', 3: '#C6821F', 4: '#D85A30', 5: '#C0392B' };

export default function SymptomFormModal({ open, onClose }) {
  const { addSymptom } = useSymptoms();
  const [datetime, setDatetime] = useState(nowForInput);
  const [description, setDescription] = useState('');
  const [intensity, setIntensity] = useState(3);

  const isValid = description.trim().length > 0 && datetime.length > 0;

  const handleClose = () => {
    setDatetime(nowForInput());
    setDescription('');
    setIntensity(3);
    onClose();
  };

  const handleSave = () => {
    if (!isValid) return;
    addSymptom({
      datetime: new Date(datetime).toISOString(),
      description: description.trim(),
      intensity,
    });
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Registrar síntoma</DialogTitle>
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
        <Button onClick={handleClose}>Cancelar</Button>
        <Button onClick={handleSave} variant="contained" disabled={!isValid}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
