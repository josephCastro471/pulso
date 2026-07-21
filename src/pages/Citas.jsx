import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';

export default function Citas() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h1" sx={{ mb: 3 }}>
        Citas
      </Typography>
      <Card>
        <CardContent>
          <Typography color="text.secondary">
            Aquí podrás ver y programar tus próximas citas médicas. Próximamente.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
