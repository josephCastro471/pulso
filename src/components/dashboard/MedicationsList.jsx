import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import { useMedications } from '../../contexts/MedicationsContext';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function MedicationsList() {
  const { medications, toggleTaken } = useMedications();
  const today = todayKey();

  if (medications.length === 0) {
    return <Typography color="text.secondary">No hay medicamentos programados para hoy.</Typography>;
  }

  return (
    <List disablePadding>
      {medications.map((med) => {
        const taken = med.takenDates.includes(today);
        return (
          <ListItemButton key={med.id} onClick={() => toggleTaken(med.id, today)} dense disableGutters>
            <ListItemIcon sx={{ minWidth: 40 }}>
              <Checkbox edge="start" checked={taken} tabIndex={-1} disableRipple />
            </ListItemIcon>
            <ListItemText
              primary={`${med.name} — ${med.dose}`}
              secondary={med.time}
              sx={{ textDecoration: taken ? 'line-through' : 'none' }}
            />
          </ListItemButton>
        );
      })}
    </List>
  );
}
