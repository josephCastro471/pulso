import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';

export default function MetricCard({ label, value, color }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography
          sx={{
            fontSize: 28,
            fontWeight: 600,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            color: color ?? 'text.primary',
          }}
        >
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}
