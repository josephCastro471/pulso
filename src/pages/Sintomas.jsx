import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';

export default function Sintomas() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h1" sx={{ mb: 3 }}>
        Síntomas
      </Typography>
      <Card>
        <CardContent>
          <Typography color="text.secondary">
            Aquí podrás registrar y consultar tus síntomas. Próximamente.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
