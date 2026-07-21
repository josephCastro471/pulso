import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';

const metrics = [
  { label: 'Síntomas (últimos 7 días)', value: '—' },
  { label: 'Adherencia a medicamentos', value: '—' },
  { label: 'Próxima cita', value: '—' },
];

export default function Dashboard() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h1" sx={{ mb: 3 }}>
        Hola 👋
      </Typography>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        {metrics.map((metric) => (
          <Grid size={{ xs: 12, sm: 4 }} key={metric.label}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  {metric.label}
                </Typography>
                <Typography sx={{ fontSize: 28, fontWeight: 600, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  {metric.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h2" sx={{ mb: 2 }}>
            Patrón de síntomas (7 días)
          </Typography>
          <Box sx={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
            Gráfico próximamente
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h2" sx={{ mb: 1 }}>
                Medicamentos de hoy
              </Typography>
              <Typography color="text.secondary">Sin datos todavía.</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h2" sx={{ mb: 1 }}>
                Próximas citas
              </Typography>
              <Typography color="text.secondary">Sin datos todavía.</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
