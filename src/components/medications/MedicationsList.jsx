import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export default function MedicationsList({ medications, onEdit, onDelete }) {
  if (medications.length === 0) {
    return <Typography color="text.secondary">No hay medicamentos registrados.</Typography>;
  }

  return (
    <List disablePadding>
      {medications.map((med) => (
        <ListItem
          key={med.id}
          disableGutters
          secondaryAction={
            <Stack direction="row" spacing={1}>
              <IconButton aria-label="Editar" onClick={() => onEdit(med)}>
                <span style={{ fontSize: 18 }}>✏️</span>
              </IconButton>
              <IconButton aria-label="Eliminar" onClick={() => onDelete(med)}>
                <span style={{ fontSize: 18 }}>🗑️</span>
              </IconButton>
            </Stack>
          }
        >
          <ListItemText primary={`${med.name} — ${med.dosage}`} secondary={med.frequency} />
        </ListItem>
      ))}
    </List>
  );
}
