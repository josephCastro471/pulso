import { useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import MetricCard from '../components/dashboard/MetricCard';
import SymptomsChart from '../components/dashboard/SymptomsChart';
import MedicationsList from '../components/dashboard/MedicationsList';
import AppointmentsList from '../components/dashboard/AppointmentsList';
import AddRecordFab from '../components/dashboard/AddRecordFab';
import SymptomFormModal from '../components/symptoms/SymptomFormModal';
import MedicationFormModal from '../components/medications/MedicationFormModal';
import AppointmentFormModal from '../components/appointments/AppointmentFormModal';
import { useAuth } from '../contexts/AuthContext';
import { useSymptoms } from '../contexts/SymptomsContext';
import { useMedications } from '../contexts/MedicationsContext';
import { useAppointments } from '../contexts/AppointmentsContext';

function formatNextAppointment(appt) {
  if (!appt) return 'Sin citas próximas';
  const d = new Date(appt.datetime);
  const date = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
}

export default function Dashboard() {
  const [modalOpen, setModalOpen] = useState(false);
  const [medicationModalOpen, setMedicationModalOpen] = useState(false);
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false);
  const { user } = useAuth();
  const { symptoms, last7Days } = useSymptoms();
  const { todayAdherence } = useMedications();
  const { nextAppointment } = useAppointments();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentSymptomsCount = symptoms.filter((s) => new Date(s.datetime) >= sevenDaysAgo).length;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h1" sx={{ mb: 3 }}>
        Hola, {user.name} 👋
      </Typography>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <MetricCard label="Síntomas (7 días)" value={recentSymptomsCount} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <MetricCard
            label="Adherencia hoy"
            value={todayAdherence === null ? 'N/A' : `${todayAdherence}%`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <MetricCard label="Próxima cita" value={formatNextAppointment(nextAppointment)} />
        </Grid>
      </Grid>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h2" sx={{ mb: 2 }}>
            Patrón de síntomas (7 días)
          </Typography>
          <SymptomsChart data={last7Days} />
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h2" sx={{ mb: 1 }}>
                Medicamentos de hoy
              </Typography>
              <MedicationsList />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h2" sx={{ mb: 1 }}>
                Próximas citas
              </Typography>
              <AppointmentsList />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <AddRecordFab
        onAddSymptom={() => setModalOpen(true)}
        onAddMedication={() => setMedicationModalOpen(true)}
        onAddAppointment={() => setAppointmentModalOpen(true)}
      />
      <SymptomFormModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <MedicationFormModal
        open={medicationModalOpen}
        onClose={() => setMedicationModalOpen(false)}
      />
      <AppointmentFormModal
        open={appointmentModalOpen}
        onClose={() => setAppointmentModalOpen(false)}
      />
    </Box>
  );
}
