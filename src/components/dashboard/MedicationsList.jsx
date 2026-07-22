import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import { useMedications } from '../../contexts/MedicationsContext';

export default function MedicationsList() {
  const { medications, toggleTaken } = useMedications();

  if (medications.length === 0) {
    return <Typography color="text.secondary">No hay medicamentos programados para hoy.</Typography>;
  }

  return (
    <List disablePadding>
      {medications.map((med) => (
        <ListItemButton key={med.id} onClick={() => toggleTaken(med.id)} dense disableGutters>
          <ListItemIcon sx={{ minWidth: 40 }}>
            <Checkbox edge="start" checked={med.takenToday} tabIndex={-1} disableRipple />
          </ListItemIcon>
          <ListItemText
            primary={`${med.name} — ${med.dosage}`}
            secondary={med.frequency}
            sx={{ textDecoration: med.takenToday ? 'line-through' : 'none' }}
          />
        </ListItemButton>
      ))}
    </List>
  );
}
