import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';

export default function Login() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 400 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h1" sx={{ mb: 1 }}>
            Pulso
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Inicia sesión para continuar
          </Typography>

          <Stack spacing={2} component="form">
            <TextField label="Correo electrónico" type="email" fullWidth />
            <TextField label="Contraseña" type="password" fullWidth />
            <Button variant="contained" color="primary" size="large" fullWidth>
              Entrar
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
