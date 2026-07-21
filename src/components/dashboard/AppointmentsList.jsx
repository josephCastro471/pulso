import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { useAppointments } from '../../contexts/AppointmentsContext';

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AppointmentsList() {
  const { appointments } = useAppointments();
  const now = Date.now();
  const upcoming = appointments
    .filter((a) => new Date(a.datetime).getTime() >= now)
    .sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

  if (upcoming.length === 0) {
    return <Typography color="text.secondary">Sin citas próximas.</Typography>;
  }

  return (
    <List disablePadding>
      {upcoming.map((appt) => (
        <ListItem key={appt.id} disableGutters>
          <ListItemText
            primary={`${appt.doctor} — ${appt.specialty}`}
            secondary={`${formatDateTime(appt.datetime)} · ${appt.location}`}
          />
        </ListItem>
      ))}
    </List>
  );
}
