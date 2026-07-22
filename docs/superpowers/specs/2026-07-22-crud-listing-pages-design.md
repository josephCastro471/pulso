# CRUD Completo en Páginas de Listado — Design Spec

**Date:** 2026-07-22
**Status:** Approved by user, ready for implementation planning

## Overview

Pulso tiene rutas `/sintomas`, `/medicamentos`, `/citas` que hoy son stubs estáticos ("Próximamente"). El Dashboard ya permite **crear** síntomas, medicamentos y citas (vía el FAB), y el backend ya expone `PUT`/`DELETE` para los tres recursos (`symptoms.routes.js`, `medications.routes.js`, `appointments.routes.js`), sin usar todavía desde el frontend.

Esta iteración convierte las tres páginas stub en vistas CRUD completas: listado de todos los registros del usuario, edición (reutilizando los modales de creación ya existentes) y eliminación con confirmación. Es puramente frontend — el backend ya cumple el contrato necesario.

### Decisiones resueltas

Presentadas y aprobadas junto con el diseño:

1. **Tope de listado sin paginación real**: la app no tiene paginación en ningún lado; medicamentos y citas ya cargan hasta `limit: 100`. Se aplica el mismo tope a los tres recursos (ver "Cambios de alcance de datos" abajo). No se implementa scroll infinito ni selector de página.
2. **Reutilización de los 3 modales existentes** (`SymptomFormModal`, `MedicationFormModal`, `AppointmentFormModal`) en vez de crear modales de edición nuevos: se les añade una prop opcional `editItem`. Sin `editItem` (o `null`), el modal se comporta exactamente igual que hoy (modo creación) — el Dashboard no requiere cambios.
3. **Sin librería de iconos**: el proyecto no depende de `@mui/icons-material` (confirmado en `package.json`); `AddRecordFab` ya usa emojis directamente. Los botones Editar/Eliminar de los listados siguen ese mismo patrón.

## Arquitectura

Mismo patrón en los tres recursos, extendiendo la cadena ya usada para creación (API → Context → Modal) con Update/Delete, y añadiendo dos tipos de componentes nuevos:

- **API** (`src/api/{symptoms,medications,appointments}.js`): nuevas funciones `updateX(id, payload)` (PUT) y `deleteX(id)` (DELETE) junto a las `createX`/`getX` existentes.
- **Contextos**: nuevos métodos `updateX(id, data)` y `removeX(id)`, mismo patrón que `addX` (llaman a la API, actualizan el array de estado local, relanzan errores para que el llamador los capture — no se atrapan dentro del contexto).
- **Modales de creación existentes**: se extienden con `editItem` para servir también como modales de edición (ver detalle abajo).
- **`ConfirmDialog`** (nuevo, compartido): diálogo de confirmación genérico para eliminar, usado por las tres páginas.
- **Listados de página completa** (nuevos): `SymptomsList`, `MedicationsList`, `AppointmentsList` — uno por recurso, ubicados en `src/components/{symptoms,medications,appointments}/`. Son distintos de los componentes homónimos bajo `src/components/dashboard/` (que siguen siendo las vistas resumidas del Dashboard y no se modifican).
- **Páginas** (`Sintomas.jsx`, `Medicamentos.jsx`, `Citas.jsx`): reemplazan el stub actual. Cada una orquesta: el listado completo, un FAB propio de un solo botón para crear, el modal (create/edit) y el `ConfirmDialog`.

## Cambios de alcance de datos

- **`SymptomsContext`**: hoy carga solo los últimos 7 días (`getSymptoms({ from, to, limit: 100 })`) porque solo alimentaba el gráfico del Dashboard. Se cambia a `getSymptoms({ limit: 100 })` (sin filtro de fecha) — carga los 100 síntomas más recientes del usuario, ordenados por el backend `datetime: desc`. `computeLast7Days` y el conteo "Síntomas (7 días)" del Dashboard siguen funcionando sin cambios porque ya filtran client-side sobre el array de `symptoms`; ahora simplemente lo hacen sobre un array más completo. La página `/sintomas` reutiliza el mismo array para el listado completo — sin fetch adicional.
- **`AppointmentsContext`**: hoy llama `getAppointments()` sin parámetros, lo que aplica el límite por defecto del backend (`limit: 20`). Se cambia a `getAppointments({ limit: 100 })`, igual que medicamentos, para que el listado completo en `/citas` no quede truncado a 20 registros.
- **`MedicationsContext`**: ya carga hasta 100 sin filtro de fecha — no requiere cambio de alcance.

## Componentes

### 1. Capa API — nuevas funciones `updateX`/`deleteX`

**`src/api/symptoms.js`** (añadir a lo existente):

```js
export async function updateSymptom(id, payload) {
  const { data } = await client.put(`/symptoms/${id}`, payload);
  return data;
}

export async function deleteSymptom(id) {
  await client.delete(`/symptoms/${id}`);
}
```

**`src/api/medications.js`** (añadir a lo existente):

```js
export async function updateMedication(id, payload) {
  const { data } = await client.put(`/medications/${id}`, payload);
  return data;
}

export async function deleteMedication(id) {
  await client.delete(`/medications/${id}`);
}
```

**`src/api/appointments.js`** (añadir a lo existente):

```js
export async function updateAppointment(id, payload) {
  const { data } = await client.put(`/appointments/${id}`, payload);
  return data;
}

export async function deleteAppointment(id) {
  await client.delete(`/appointments/${id}`);
}
```

Los tres `DELETE` responden `204 No Content` (confirmado en los controllers de backend) — no hay `data` que devolver.

### 2. Capa Context — nuevos métodos + cambios de alcance

**`src/contexts/SymptomsContext.jsx`** — reemplazo completo:

```jsx
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  getSymptoms,
  createSymptom,
  updateSymptom as updateSymptomApi,
  deleteSymptom as deleteSymptomApi,
} from '../api/symptoms';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';

function computeLast7Days(symptoms) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '');
    days.push({ date: key, label, intensities: [] });
  }
  const byKey = Object.fromEntries(days.map((d) => [d.date, d]));
  symptoms.forEach((s) => {
    const key = s.datetime.slice(0, 10);
    if (byKey[key]) byKey[key].intensities.push(s.intensity);
  });
  return days.map(({ date, label, intensities }) => ({
    date,
    label,
    avgIntensity: intensities.length
      ? intensities.reduce((a, b) => a + b, 0) / intensities.length
      : null,
  }));
}

const SymptomsContext = createContext(null);

export function SymptomsProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const { notifyError } = useNotification();
  const [symptoms, setSymptoms] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setSymptoms([]);
      return;
    }
    let ignore = false;

    setLoading(true);
    getSymptoms({ limit: 100 })
      .then((res) => { if (!ignore) setSymptoms(res.data); })
      .catch((err) => { if (!ignore) notifyError(err.message || 'No se pudieron cargar los síntomas'); })
      .finally(() => { if (!ignore) setLoading(false); });

    return () => { ignore = true; };
  }, [isAuthenticated, notifyError]);

  const addSymptom = async (entry) => {
    const created = await createSymptom(entry);
    setSymptoms((prev) => [created, ...prev]);
    return created;
  };

  const updateSymptom = async (id, data) => {
    const updated = await updateSymptomApi(id, data);
    setSymptoms((prev) => prev.map((s) => (s.id === id ? updated : s)));
    return updated;
  };

  const removeSymptom = async (id) => {
    await deleteSymptomApi(id);
    setSymptoms((prev) => prev.filter((s) => s.id !== id));
  };

  const last7Days = useMemo(() => computeLast7Days(symptoms), [symptoms]);

  const value = useMemo(
    () => ({ symptoms, addSymptom, updateSymptom, removeSymptom, last7Days, loading }),
    [symptoms, last7Days, loading]
  );

  return <SymptomsContext.Provider value={value}>{children}</SymptomsContext.Provider>;
}

export function useSymptoms() {
  const ctx = useContext(SymptomsContext);
  if (!ctx) throw new Error('useSymptoms debe usarse dentro de SymptomsProvider');
  return ctx;
}
```

**`src/contexts/MedicationsContext.jsx`** — reemplazo completo:

```jsx
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  getMedications,
  getMedicationLogs,
  upsertMedicationLog,
  createMedication,
  updateMedication as updateMedicationApi,
  deleteMedication as deleteMedicationApi,
} from '../api/medications';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

const MedicationsContext = createContext(null);

export function MedicationsProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const { notifyError } = useNotification();
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setMedications([]);
      return;
    }
    let ignore = false;

    const today = todayKey();
    setLoading(true);
    getMedications({ limit: 100 })
      .then(async (res) => {
        const withLogs = await Promise.all(
          res.data.map(async (med) => {
            const logsRes = await getMedicationLogs(med.id, { from: today, to: today });
            const takenToday = logsRes.data.some((log) => log.date.slice(0, 10) === today && log.taken);
            return { ...med, takenToday };
          })
        );
        if (!ignore) setMedications(withLogs);
      })
      .catch((err) => { if (!ignore) notifyError(err.message || 'No se pudieron cargar los medicamentos'); })
      .finally(() => { if (!ignore) setLoading(false); });

    return () => { ignore = true; };
  }, [isAuthenticated, notifyError]);

  const toggleTaken = async (id) => {
    const med = medications.find((m) => m.id === id);
    if (!med) return;

    try {
      const log = await upsertMedicationLog(id, { date: todayKey(), taken: !med.takenToday });
      setMedications((prev) => prev.map((m) => (m.id === id ? { ...m, takenToday: log.taken } : m)));
    } catch (err) {
      notifyError(err.message || 'No se pudo actualizar el medicamento');
    }
  };

  const addMedication = async (data) => {
    const created = await createMedication(data);
    setMedications((prev) => [...prev, { ...created, takenToday: false }]);
  };

  const updateMedication = async (id, data) => {
    const updated = await updateMedicationApi(id, data);
    setMedications((prev) =>
      prev.map((m) => (m.id === id ? { ...updated, takenToday: m.takenToday } : m))
    );
    return updated;
  };

  const removeMedication = async (id) => {
    await deleteMedicationApi(id);
    setMedications((prev) => prev.filter((m) => m.id !== id));
  };

  const todayAdherence = useMemo(() => {
    if (medications.length === 0) return null;
    const takenCount = medications.filter((med) => med.takenToday).length;
    return Math.round((takenCount / medications.length) * 100);
  }, [medications]);

  const value = useMemo(
    () => ({
      medications,
      toggleTaken,
      addMedication,
      updateMedication,
      removeMedication,
      todayAdherence,
      loading,
    }),
    [medications, todayAdherence, loading]
  );

  return <MedicationsContext.Provider value={value}>{children}</MedicationsContext.Provider>;
}

export function useMedications() {
  const ctx = useContext(MedicationsContext);
  if (!ctx) throw new Error('useMedications debe usarse dentro de MedicationsProvider');
  return ctx;
}
```

`updateMedication` fusiona la respuesta del backend con el `takenToday` local existente, porque el PUT del backend no conoce ese campo (es una anotación calculada solo en el frontend a partir de los logs de hoy).

**`src/contexts/AppointmentsContext.jsx`** — reemplazo completo:

```jsx
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  getAppointments,
  createAppointment,
  updateAppointment as updateAppointmentApi,
  deleteAppointment as deleteAppointmentApi,
} from '../api/appointments';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';

const AppointmentsContext = createContext(null);

export function AppointmentsProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const { notifyError } = useNotification();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setAppointments([]);
      return;
    }

    setLoading(true);
    getAppointments({ limit: 100 })
      .then((res) => setAppointments(res.data))
      .catch((err) => notifyError(err.message || 'No se pudieron cargar las citas'))
      .finally(() => setLoading(false));
  }, [isAuthenticated, notifyError]);

  const nextAppointment = useMemo(() => {
    const now = Date.now();
    const future = appointments
      .filter((a) => new Date(a.datetime).getTime() >= now)
      .sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
    return future.length > 0 ? future[0] : null;
  }, [appointments]);

  const addAppointment = async (data) => {
    const created = await createAppointment(data);
    setAppointments((prev) => [...prev, created]);
  };

  const updateAppointment = async (id, data) => {
    const updated = await updateAppointmentApi(id, data);
    setAppointments((prev) => prev.map((a) => (a.id === id ? updated : a)));
    return updated;
  };

  const removeAppointment = async (id) => {
    await deleteAppointmentApi(id);
    setAppointments((prev) => prev.filter((a) => a.id !== id));
  };

  const value = useMemo(
    () => ({
      appointments,
      nextAppointment,
      addAppointment,
      updateAppointment,
      removeAppointment,
      loading,
    }),
    [appointments, nextAppointment, loading]
  );

  return <AppointmentsContext.Provider value={value}>{children}</AppointmentsContext.Provider>;
}

export function useAppointments() {
  const ctx = useContext(AppointmentsContext);
  if (!ctx) throw new Error('useAppointments debe usarse dentro de AppointmentsProvider');
  return ctx;
}
```

### 3. Modales existentes — modo edición vía prop `editItem`

Los tres modales ganan una prop opcional `editItem = null`. Cuando el modal se abre (`open` pasa a `true`), un `useEffect` sobre `[open, editItem]` inicializa los campos: desde `editItem` si existe, o a los valores por defecto de creación si no. Esto reemplaza el reset manual que hoy vive en `handleClose` — ya no hace falta, porque la siguiente apertura del modal siempre re-inicializa vía el efecto. `handleSave` llama a `updateX(editItem.id, payload)` si `editItem` existe, o a `addX(payload)` si no. El título y el texto del botón de guardar cambian según el modo.

**`src/components/symptoms/SymptomFormModal.jsx`** — reemplazo completo:

```jsx
import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { useSymptoms } from '../../contexts/SymptomsContext';
import { useNotification } from '../../contexts/NotificationContext';

function toDatetimeLocalValue(date) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function nowForInput() {
  return toDatetimeLocalValue(new Date());
}

const marks = [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) }));
const intensityColors = { 1: '#3B8C5A', 2: '#8FB03E', 3: '#C6821F', 4: '#D85A30', 5: '#C0392B' };

export default function SymptomFormModal({ open, onClose, editItem = null }) {
  const { addSymptom, updateSymptom } = useSymptoms();
  const { notifyError } = useNotification();
  const [datetime, setDatetime] = useState(nowForInput);
  const [description, setDescription] = useState('');
  const [intensity, setIntensity] = useState(3);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editItem) {
      setDatetime(toDatetimeLocalValue(editItem.datetime));
      setDescription(editItem.description);
      setIntensity(editItem.intensity);
    } else {
      setDatetime(nowForInput());
      setDescription('');
      setIntensity(3);
    }
  }, [open, editItem]);

  const isValid = description.trim().length > 0 && datetime.length > 0;

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const payload = {
        datetime: new Date(datetime).toISOString(),
        description: description.trim(),
        intensity,
      };
      if (editItem) {
        await updateSymptom(editItem.id, payload);
      } else {
        await addSymptom(payload);
      }
      onClose();
    } catch (err) {
      notifyError(err.message || 'No se pudo guardar el síntoma');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editItem ? 'Editar síntoma' : 'Registrar síntoma'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
        <TextField
          label="Fecha y hora"
          type="datetime-local"
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          fullWidth
        />
        <TextField
          label="Descripción"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          multiline
          minRows={3}
          fullWidth
          required
        />
        <Box>
          <Typography gutterBottom color="text.secondary">
            Intensidad
          </Typography>
          <Slider
            value={intensity}
            onChange={(_, value) => setIntensity(value)}
            step={1}
            min={1}
            max={5}
            marks={marks}
            sx={{ color: intensityColors[intensity] }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} variant="contained" disabled={!isValid || saving}>
          {saving ? 'Guardando...' : editItem ? 'Guardar cambios' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

**`src/components/medications/MedicationFormModal.jsx`** — reemplazo completo:

```jsx
import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import { useMedications } from '../../contexts/MedicationsContext';
import { useNotification } from '../../contexts/NotificationContext';

export default function MedicationFormModal({ open, onClose, editItem = null }) {
  const { addMedication, updateMedication } = useMedications();
  const { notifyError } = useNotification();
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editItem) {
      setName(editItem.name);
      setDosage(editItem.dosage);
      setFrequency(editItem.frequency);
    } else {
      setName('');
      setDosage('');
      setFrequency('');
    }
  }, [open, editItem]);

  const isValid = name.trim().length > 0 && dosage.trim().length > 0 && frequency.trim().length > 0;

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        dosage: dosage.trim(),
        frequency: frequency.trim(),
      };
      if (editItem) {
        await updateMedication(editItem.id, payload);
      } else {
        await addMedication(payload);
      }
      onClose();
    } catch (err) {
      notifyError(err.message || 'No se pudo guardar el medicamento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editItem ? 'Editar medicamento' : 'Registrar medicamento'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
        <TextField
          label="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          required
        />
        <TextField
          label="Dosis"
          value={dosage}
          onChange={(e) => setDosage(e.target.value)}
          placeholder="50mg"
          fullWidth
          required
        />
        <TextField
          label="Frecuencia"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          placeholder="Cada 8 horas"
          fullWidth
          required
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} variant="contained" disabled={!isValid || saving}>
          {saving ? 'Guardando...' : editItem ? 'Guardar cambios' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

**`src/components/appointments/AppointmentFormModal.jsx`** — reemplazo completo:

```jsx
import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import { useAppointments } from '../../contexts/AppointmentsContext';
import { useNotification } from '../../contexts/NotificationContext';

function toDatetimeLocalValue(date) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function nowForInput() {
  return toDatetimeLocalValue(new Date());
}

export default function AppointmentFormModal({ open, onClose, editItem = null }) {
  const { addAppointment, updateAppointment } = useAppointments();
  const { notifyError } = useNotification();
  const [doctor, setDoctor] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [datetime, setDatetime] = useState(nowForInput);
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editItem) {
      setDoctor(editItem.doctor);
      setSpecialty(editItem.specialty);
      setDatetime(toDatetimeLocalValue(editItem.datetime));
      setLocation(editItem.location);
    } else {
      setDoctor('');
      setSpecialty('');
      setDatetime(nowForInput());
      setLocation('');
    }
  }, [open, editItem]);

  const isValid =
    doctor.trim().length > 0 &&
    specialty.trim().length > 0 &&
    datetime.length > 0 &&
    location.trim().length > 0;

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const payload = {
        doctor: doctor.trim(),
        specialty: specialty.trim(),
        datetime: new Date(datetime).toISOString(),
        location: location.trim(),
      };
      if (editItem) {
        await updateAppointment(editItem.id, payload);
      } else {
        await addAppointment(payload);
      }
      onClose();
    } catch (err) {
      notifyError(err.message || 'No se pudo guardar la cita');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editItem ? 'Editar cita' : 'Registrar cita'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
        <TextField label="Doctor" value={doctor} onChange={(e) => setDoctor(e.target.value)} fullWidth required />
        <TextField label="Especialidad" value={specialty} onChange={(e) => setSpecialty(e.target.value)} fullWidth required />
        <TextField
          label="Fecha y hora"
          type="datetime-local"
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          fullWidth
          required
        />
        <TextField label="Ubicación" value={location} onChange={(e) => setLocation(e.target.value)} fullWidth required />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} variant="contained" disabled={!isValid || saving}>
          {saving ? 'Guardando...' : editItem ? 'Guardar cambios' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

`Dashboard.jsx` sigue instanciando estos tres modales sin pasar `editItem` — al ser `null` por defecto, su comportamiento de creación es idéntico al actual. **No requiere ningún cambio.**

### 4. `src/components/common/ConfirmDialog.jsx` — nuevo, compartido

Carpeta `src/components/common/` es nueva.

```jsx
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel, loading = false }) {
  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={loading}>Cancelar</Button>
        <Button onClick={onConfirm} color="error" variant="contained" disabled={loading}>
          {loading ? 'Eliminando...' : 'Eliminar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

### 5. Listados de página completa — nuevos

Cada uno recibe el array completo del recurso más `onEdit(item)`/`onDelete(item)`, y renderiza cada fila con los campos pedidos + botones Editar/Eliminar (emoji, sin librería de iconos). Estado vacío con mensaje, igual patrón que los listados del Dashboard.

**`src/components/symptoms/SymptomsList.jsx`** — nuevo:

```jsx
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function SymptomsList({ symptoms, onEdit, onDelete }) {
  if (symptoms.length === 0) {
    return <Typography color="text.secondary">No hay síntomas registrados.</Typography>;
  }

  return (
    <List disablePadding>
      {symptoms.map((symptom) => (
        <ListItem
          key={symptom.id}
          disableGutters
          secondaryAction={
            <Stack direction="row" spacing={1}>
              <IconButton aria-label="Editar" onClick={() => onEdit(symptom)}>
                <span style={{ fontSize: 18 }}>✏️</span>
              </IconButton>
              <IconButton aria-label="Eliminar" onClick={() => onDelete(symptom)}>
                <span style={{ fontSize: 18 }}>🗑️</span>
              </IconButton>
            </Stack>
          }
        >
          <ListItemText
            primary={`${formatDateTime(symptom.datetime)} — Intensidad ${symptom.intensity}`}
            secondary={symptom.description}
          />
        </ListItem>
      ))}
    </List>
  );
}
```

**`src/components/medications/MedicationsList.jsx`** — nuevo (distinto de `src/components/dashboard/MedicationsList.jsx`):

```jsx
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export default function MedicationsList({ medications, onEdit, onDelete }) {
  if (medications.length === 0) {
    return <Typography color="text.secondary">No hay medicamentos registrados.</Typography>;
  }

  return (
    <List disablePadding>
      {medications.map((med) => (
        <ListItem
          key={med.id}
          disableGutters
          secondaryAction={
            <Stack direction="row" spacing={1}>
              <IconButton aria-label="Editar" onClick={() => onEdit(med)}>
                <span style={{ fontSize: 18 }}>✏️</span>
              </IconButton>
              <IconButton aria-label="Eliminar" onClick={() => onDelete(med)}>
                <span style={{ fontSize: 18 }}>🗑️</span>
              </IconButton>
            </Stack>
          }
        >
          <ListItemText primary={`${med.name} — ${med.dosage}`} secondary={med.frequency} />
        </ListItem>
      ))}
    </List>
  );
}
```

**`src/components/appointments/AppointmentsList.jsx`** — nuevo (distinto de `src/components/dashboard/AppointmentsList.jsx`):

```jsx
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AppointmentsList({ appointments, onEdit, onDelete }) {
  if (appointments.length === 0) {
    return <Typography color="text.secondary">No hay citas registradas.</Typography>;
  }

  return (
    <List disablePadding>
      {appointments.map((appt) => (
        <ListItem
          key={appt.id}
          disableGutters
          secondaryAction={
            <Stack direction="row" spacing={1}>
              <IconButton aria-label="Editar" onClick={() => onEdit(appt)}>
                <span style={{ fontSize: 18 }}>✏️</span>
              </IconButton>
              <IconButton aria-label="Eliminar" onClick={() => onDelete(appt)}>
                <span style={{ fontSize: 18 }}>🗑️</span>
              </IconButton>
            </Stack>
          }
        >
          <ListItemText
            primary={`${appt.doctor} — ${appt.specialty}`}
            secondary={`${formatDateTime(appt.datetime)} · ${appt.location}`}
          />
        </ListItem>
      ))}
    </List>
  );
}
```

### 6. Páginas — reemplazan los stubs

Cada página: título, `Card` con el listado completo, un `Fab` propio (un solo botón "+", sin `SpeedDial`, distinto del `AddRecordFab` del Dashboard) para crear, el modal en modo create/edit, y el `ConfirmDialog`.

**`src/pages/Sintomas.jsx`** — reemplazo completo:

```jsx
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
```

**`src/pages/Medicamentos.jsx`** — reemplazo completo:

```jsx
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
```

**`src/pages/Citas.jsx`** — reemplazo completo:

```jsx
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
```

### Componentes sin cambios

- `src/App.jsx` — las rutas `/sintomas`, `/medicamentos`, `/citas` ya existen y ya montan estos componentes de página; no requiere cambios.
- `src/components/dashboard/AddRecordFab.jsx`, `src/pages/Dashboard.jsx` — el Dashboard sigue creando registros exactamente igual (los modales no reciben `editItem` ahí).
- `src/components/dashboard/MedicationsList.jsx`, `src/components/dashboard/AppointmentsList.jsx` — vistas resumidas del Dashboard, no se tocan.
- Backend completo — los endpoints `PUT`/`DELETE` ya existen con la validación y el contrato de respuesta exactos que este trabajo necesita.

## Flujo de datos

**Editar:**
1. Usuario hace clic en ✏️ de una fila → la página llama `onEdit(item)` → guarda `item` en `editingX` state → abre el modal.
2. El modal detecta `editItem` no nulo, precarga sus campos, cambia título/botón a modo edición.
3. Usuario modifica y hace clic en "Guardar cambios" → el modal llama `updateX(editItem.id, payload)` del contexto.
4. El contexto llama `PUT /api/{recurso}/:id` → en éxito reemplaza el ítem en el array de estado → el listado se actualiza de inmediato (misma referencia de array, nuevo objeto).
5. El modal se cierra (`onClose()`); la próxima vez que se abra sin `editItem`, el `useEffect` lo reinicializa en modo creación.

**Eliminar:**
1. Usuario hace clic en 🗑️ de una fila → la página guarda el ítem en `deletingX` state → `ConfirmDialog` se abre (`open={!!deletingX}`).
2. Usuario confirma → la página llama `removeX(deletingX.id)` del contexto, con `deleting = true` mientras está en curso (deshabilita los botones del diálogo).
3. El contexto llama `DELETE /api/{recurso}/:id` → en éxito filtra el ítem del array de estado → el listado se actualiza de inmediato; se muestra `notifySuccess`.
4. El diálogo se cierra limpiando `deletingX`.

## Manejo de errores

- Error al editar (red, validación backend, 404 si el ítem ya no existe, etc.): el modal permanece abierto, `notifyError` muestra el mensaje vía el snackbar global, `saving` vuelve a `false` para reintentar.
- Error al eliminar: el `ConfirmDialog` permanece abierto, `notifyError` muestra el mensaje, `deleting` vuelve a `false` para reintentar o cancelar.
- Los tres contextos relanzan (`throw`) los errores de `updateX`/`removeX` sin capturarlos — igual que `addX` — para que sea siempre el componente que inició la acción (modal o página) quien decida cómo notificar y qué hacer con su estado de carga.

## Testing / Verificación

No existe test runner de frontend en este proyecto (solo `oxlint`). Verificación manual:

1. Levantar backend (`npm run dev` en `server/`) y frontend (`npm run dev` en la raíz). Iniciar sesión.
2. **Síntomas**: entrar a `/sintomas` → confirmar que se listan todos los síntomas existentes (fecha, descripción, intensidad). Crear uno nuevo con el FAB → aparece en el listado. Editarlo (cambiar descripción/intensidad/fecha) → el listado refleja el cambio. Eliminarlo → confirmar el diálogo → desaparece del listado. Confirmar que el Dashboard (gráfico "Patrón de síntomas" y métrica "Síntomas (7 días)") sigue funcionando sin regresiones.
3. **Medicamentos**: entrar a `/medicamentos` → confirmar listado completo (nombre, dosis, frecuencia). Crear, editar, eliminar — mismos pasos. Confirmar que el checkbox "tomado hoy" del Dashboard sigue funcionando después de editar un medicamento desde `/medicamentos` (el `takenToday` no debe perderse).
4. **Citas**: entrar a `/citas` → confirmar listado completo de TODAS las citas (no solo futuras, a diferencia del widget del Dashboard). Crear, editar, eliminar — mismos pasos. Confirmar que "Próxima cita" y "Próximas citas" del Dashboard reflejan los cambios hechos desde `/citas`.
5. Intentar guardar un formulario de edición con un campo requerido vacío → el botón "Guardar cambios" permanece deshabilitado, igual que en creación.
6. Cancelar una edición a mitad de camino → reabrir el modal (crear o editar otro ítem) → confirmar que no quedan datos residuales del intento cancelado.
7. Ejecutar `oxlint` para confirmar que no hay nuevas advertencias/errores de lint.

## Fuera de alcance

- Sin paginación real, scroll infinito, ni filtros/búsqueda en los listados — tope fijo de 100 ítems por recurso, igual que el resto de la app.
- Sin tests automatizados (ni frontend ni backend) — el backend ya tiene su propia suite existente que no se toca; no se añaden tests de frontend porque no existe test runner en el proyecto.
- Sin cambios de backend — los endpoints, esquemas de validación y contratos de respuesta ya existentes cumplen exactamente lo que este trabajo necesita.
- Sin confirmación de "cambios sin guardar" al cerrar un modal de edición a mitad de camino (comportamiento ya idéntico al de los modales de creación existentes).
- No se sube nada a GitHub — todo el trabajo (incluyendo commits locales) permanece en el repositorio local.
