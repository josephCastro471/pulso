import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Fab from '@mui/material/Fab';
import AppointmentsList from '../components/appointments/AppointmentsList';
import AppointmentFormModal from '../components/appointments/AppointmentFormModal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useAppointments } from '../contexts/AppointmentsContext';
import { useNotification } from '../contexts/NotificationContext';

export default function Citas() {
  const { appointments, removeAppointment } = useAppointments();
  const { notifyError, notifySuccess } = useNotification();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [deletingAppointment, setDeletingAppointment] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const handleAdd = () => {
    setEditingAppointment(null);
    setModalOpen(true);
  };

  const handleEdit = (appointment) => {
    setEditingAppointment(appointment);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingAppointment(null);
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await removeAppointment(deletingAppointment.id);
      notifySuccess('Cita eliminada');
      setDeletingAppointment(null);
    } catch (err) {
      notifyError(err.message || 'No se pudo eliminar la cita');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h1" sx={{ mb: 3 }}>
        Citas
      </Typography>
      <Card>
        <CardContent>
          <AppointmentsList appointments={appointments} onEdit={handleEdit} onDelete={setDeletingAppointment} />
        </CardContent>
      </Card>

      <Fab
        color="primary"
        sx={{ position: 'fixed', bottom: 24, right: 24 }}
        onClick={handleAdd}
        aria-label="Añadir cita"
      >
        <span style={{ fontSize: 24, lineHeight: 1 }}>+</span>
      </Fab>

      <AppointmentFormModal open={modalOpen} onClose={handleCloseModal} editItem={editingAppointment} />
      <ConfirmDialog
        open={!!deletingAppointment}
        title="Eliminar cita"
        message="¿Seguro que deseas eliminar esta cita? Esta acción no se puede deshacer."
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingAppointment(null)}
        loading={deleting}
      />
    </Box>
  );
}
