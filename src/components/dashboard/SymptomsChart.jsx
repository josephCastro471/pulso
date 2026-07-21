import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default function SymptomsChart({ data }) {
  const hasData = data.some((d) => d.avgIntensity !== null);

  if (!hasData) {
    return (
      <Box
        sx={{
          height: 240,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography color="text.secondary">Aún no hay registros</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis domain={[0, 5]} allowDecimals={false} />
          <Tooltip formatter={(value) => [value != null ? value.toFixed(1) : '—', 'Intensidad']} />
          <Line
            type="monotone"
            dataKey="avgIntensity"
            stroke="#0E7C86"
            strokeWidth={2}
            connectNulls={false}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}
