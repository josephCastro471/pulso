import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Fab from '@mui/material/Fab';
import SymptomsList from '../components/symptoms/SymptomsList';
import SymptomFormModal from '../components/symptoms/SymptomFormModal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useSymptoms } from '../contexts/SymptomsContext';
import { useNotification } from '../contexts/NotificationContext';

export default function Sintomas() {
  const { symptoms, removeSymptom } = useSymptoms();
  const { notifyError, notifySuccess } = useNotification();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSymptom, setEditingSymptom] = useState(null);
  const [deletingSymptom, setDeletingSymptom] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const handleAdd = () => {
    setEditingSymptom(null);
    setModalOpen(true);
  };

  const handleEdit = (symptom) => {
    setEditingSymptom(symptom);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingSymptom(null);
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await removeSymptom(deletingSymptom.id);
      notifySuccess('Síntoma eliminado');
      setDeletingSymptom(null);
    } catch (err) {
      notifyError(err.message || 'No se pudo eliminar el síntoma');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h1" sx={{ mb: 3 }}>
        Síntomas
      </Typography>
      <Card>
        <CardContent>
          <SymptomsList symptoms={symptoms} onEdit={handleEdit} onDelete={setDeletingSymptom} />
        </CardContent>
      </Card>

      <Fab
        color="primary"
        sx={{ position: 'fixed', bottom: 24, right: 24 }}
        onClick={handleAdd}
        aria-label="Añadir síntoma"
      >
        <span style={{ fontSize: 24, lineHeight: 1 }}>+</span>
      </Fab>

      <SymptomFormModal open={modalOpen} onClose={handleCloseModal} editItem={editingSymptom} />
      <ConfirmDialog
        open={!!deletingSymptom}
        title="Eliminar síntoma"
        message="¿Seguro que deseas eliminar este síntoma? Esta acción no se puede deshacer."
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingSymptom(null)}
        loading={deleting}
      />
    </Box>
  );
}
