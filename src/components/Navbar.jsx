import { NavLink, useNavigate } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import { useColorMode } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/sintomas', label: 'Síntomas' },
  { to: '/medicamentos', label: 'Medicamentos' },
  { to: '/citas', label: 'Citas' },
];

export default function Navbar() {
  const { mode, toggleColorMode } = useColorMode();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <AppBar position="sticky" color="primary" elevation={0}>
      <Toolbar sx={{ gap: 3 }}>
        <Typography variant="h6" component="div" sx={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600 }}>
          Pulso
        </Typography>

        <Stack direction="row" spacing={1} sx={{ flexGrow: 1 }}>
          {links.map((link) => (
            <Button
              key={link.to}
              component={NavLink}
              to={link.to}
              color="inherit"
              sx={{
                '&.active': {
                  backgroundColor: 'rgba(255,255,255,0.15)',
                },
              }}
            >
              {link.label}
            </Button>
          ))}
        </Stack>

        <IconButton color="inherit" onClick={toggleColorMode} aria-label="Cambiar tema">
          <Typography component="span" sx={{ fontSize: 20 }}>
            {mode === 'dark' ? '☀️' : '🌙'}
          </Typography>
        </IconButton>

        <IconButton color="inherit" onClick={handleLogout} aria-label="Cerrar sesión">
          <Typography component="span" sx={{ fontSize: 20 }}>
            🚪
          </Typography>
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}
