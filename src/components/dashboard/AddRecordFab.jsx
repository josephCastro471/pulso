import { useState } from 'react';
import SpeedDial from '@mui/material/SpeedDial';
import SpeedDialAction from '@mui/material/SpeedDialAction';

const actions = [
  { key: 'sintoma', icon: '🩺', name: 'Síntoma', disabled: false },
  { key: 'medicamento', icon: '💊', name: 'Medicamento', disabled: true },
  { key: 'cita', icon: '📅', name: 'Cita', disabled: true },
];

export default function AddRecordFab({ onAddSymptom }) {
  const [open, setOpen] = useState(false);

  const handleActionClick = (key) => {
    setOpen(false);
    if (key === 'sintoma') onAddSymptom();
  };

  return (
    <SpeedDial
      ariaLabel="Añadir registro"
      sx={{ position: 'fixed', bottom: 24, right: 24 }}
      icon={<span style={{ fontSize: 24, lineHeight: 1 }}>+</span>}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
    >
      {actions.map((action) => (
        <SpeedDialAction
          key={action.key}
          icon={<span style={{ fontSize: 20 }}>{action.icon}</span>}
          slotProps={{
            tooltip: {
              title: action.disabled ? `${action.name} (Próximamente)` : action.name,
              open: true,
            },
            fab: { disabled: action.disabled },
          }}
          onClick={() => handleActionClick(action.key)}
        />
      ))}
    </SpeedDial>
  );
}
