import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Fab from '@mui/material/Fab';
import MedicationsList from '../components/medications/MedicationsList';
import MedicationFormModal from '../components/medications/MedicationFormModal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useMedications } from '../contexts/MedicationsContext';
import { useNotification } from '../contexts/NotificationContext';

export default function Medicamentos() {
  const { medications, removeMedication } = useMedications();
  const { notifyError, notifySuccess } = useNotification();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMedication, setEditingMedication] = useState(null);
  const [deletingMedication, setDeletingMedication] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const handleAdd = () => {
    setEditingMedication(null);
    setModalOpen(true);
  };

  const handleEdit = (medication) => {
    setEditingMedication(medication);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingMedication(null);
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await removeMedication(deletingMedication.id);
      notifySuccess('Medicamento eliminado');
      setDeletingMedication(null);
    } catch (err) {
      notifyError(err.message || 'No se pudo eliminar el medicamento');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h1" sx={{ mb: 3 }}>
        Medicamentos
      </Typography>
      <Card>
        <CardContent>
          <MedicationsList medications={medications} onEdit={handleEdit} onDelete={setDeletingMedication} />
        </CardContent>
      </Card>

      <Fab
        color="primary"
        sx={{ position: 'fixed', bottom: 24, right: 24 }}
        onClick={handleAdd}
        aria-label="Añadir medicamento"
      >
        <span style={{ fontSize: 24, lineHeight: 1 }}>+</span>
      </Fab>

      <MedicationFormModal open={modalOpen} onClose={handleCloseModal} editItem={editingMedication} />
      <ConfirmDialog
        open={!!deletingMedication}
        title="Eliminar medicamento"
        message="¿Seguro que deseas eliminar este medicamento? Esta acción no se puede deshacer."
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingMedication(null)}
        loading={deleting}
      />
    </Box>
  );
}
