import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';

export default function Medicamentos() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h1" sx={{ mb: 3 }}>
        Medicamentos
      </Typography>
      <Card>
        <CardContent>
          <Typography color="text.secondary">
            Aquí podrás gestionar tus medicamentos y su adherencia. Próximamente.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
