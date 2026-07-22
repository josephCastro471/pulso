import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function SymptomsList({ symptoms, onEdit, onDelete }) {
  if (symptoms.length === 0) {
    return <Typography color="text.secondary">No hay síntomas registrados.</Typography>;
  }

  return (
    <List disablePadding>
      {symptoms.map((symptom) => (
        <ListItem
          key={symptom.id}
          disableGutters
          secondaryAction={
            <Stack direction="row" spacing={1}>
              <IconButton aria-label="Editar" onClick={() => onEdit(symptom)}>
                <span style={{ fontSize: 18 }}>✏️</span>
              </IconButton>
              <IconButton aria-label="Eliminar" onClick={() => onDelete(symptom)}>
                <span style={{ fontSize: 18 }}>🗑️</span>
              </IconButton>
            </Stack>
          }
        >
          <ListItemText
            primary={`${formatDateTime(symptom.datetime)} — Intensidad ${symptom.intensity}`}
            secondary={symptom.description}
          />
        </ListItem>
      ))}
    </List>
  );
}
