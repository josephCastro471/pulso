# CRUD Listing Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the `/sintomas`, `/medicamentos`, `/citas` stub pages into full CRUD views (list all, edit, delete with confirmation), reusing the existing create modals and backend `PUT`/`DELETE` endpoints.

**Architecture:** Extend the existing API→Context→Modal chain (already used for create) with `updateX`/`deleteX` API functions and `updateX`/`removeX` context methods per resource. Existing create modals gain an optional `editItem` prop to double as edit modals. New per-resource list components render the full array with Edit/Delete actions. New shared `ConfirmDialog` gates deletes. Three rewritten pages wire it all together.

**Tech Stack:** React 19, MUI 9 (`@mui/material`, no `@mui/icons-material`), React Router 7, Axios, Vite. Backend (unchanged): Express + Prisma + Zod, already exposes `PUT`/`DELETE /api/{symptoms,medications,appointments}/:id`.

## Global Constraints

- No backend changes — `PUT`/`DELETE` endpoints, Zod schemas, and response contracts already match what this plan needs (confirmed by reading `server/src/routes/*.routes.js`, `server/src/schemas/*.schema.js`, `server/src/controllers/*.controller.js`).
- No new dependencies — no `@mui/icons-material`; Edit/Delete buttons use emoji (`✏️`/`🗑️`), matching `AddRecordFab.jsx`'s existing pattern.
- `SymptomsContext` fetch changes from `getSymptoms({ from, to, limit: 100 })` (last 7 days) to `getSymptoms({ limit: 100 })` (100 most recent, no date filter) — same array now serves both the Dashboard chart and the full `/sintomas` listing.
- `AppointmentsContext` fetch changes from `getAppointments()` (server default `limit: 20`) to `getAppointments({ limit: 100 })`, matching medications' existing cap.
- Existing create modals (`SymptomFormModal`, `MedicationFormModal`, `AppointmentFormModal`) get an optional `editItem = null` prop. When `null`, behavior is byte-identical to today (Dashboard's usage requires zero changes). When set, the modal preloads its fields and calls `updateX` instead of `addX`.
- No automated frontend tests exist (only `oxlint` — `npm run lint`). Verification is manual, via both dev servers running, per each task's Testing section.
- Work happens on branch `feature/crud-listing-pages` (already created off `master`). All commits stay local — no `git push`, no PR.
- Full design reference: `docs/superpowers/specs/2026-07-22-crud-listing-pages-design.md`.

---

### Task 1: Shared `ConfirmDialog` component

**Files:**
- Create: `src/components/common/ConfirmDialog.jsx`

**Interfaces:**
- Produces: `ConfirmDialog({ open, title, message, onConfirm, onCancel, loading = false })` — default export, generic delete-confirmation dialog used by all three pages (Tasks 5, 9, 13).

- [ ] **Step 1: Create the component**

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

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors/warnings from this file.

- [ ] **Step 3: Commit**

```bash
git add src/components/common/ConfirmDialog.jsx
git commit -m "feat: add shared ConfirmDialog component for delete confirmations"
```

---

### Task 2: Symptoms — API + Context (update/remove + data-scope change)

**Files:**
- Modify: `src/api/symptoms.js` (full file)
- Modify: `src/contexts/SymptomsContext.jsx` (full file)

**Interfaces:**
- Produces (`src/api/symptoms.js`): `updateSymptom(id, payload)` → PUT, returns updated symptom object. `deleteSymptom(id)` → DELETE, returns nothing.
- Produces (`SymptomsContext` value): `updateSymptom(id, data)` → calls API, replaces item in `symptoms` array, returns updated item, throws on error. `removeSymptom(id)` → calls API, filters item out of `symptoms` array, throws on error. Existing `symptoms`, `addSymptom`, `last7Days`, `loading` unchanged in shape.
- Consumes: nothing from other tasks.

- [ ] **Step 1: Add `updateSymptom`/`deleteSymptom` to the API layer**

Replace the full contents of `src/api/symptoms.js` with:

```js
import client from './client';

export async function getSymptoms(params = {}) {
  const { data } = await client.get('/symptoms', { params });
  return data;
}

export async function createSymptom(payload) {
  const { data } = await client.post('/symptoms', payload);
  return data;
}

export async function updateSymptom(id, payload) {
  const { data } = await client.put(`/symptoms/${id}`, payload);
  return data;
}

export async function deleteSymptom(id) {
  await client.delete(`/symptoms/${id}`);
}
```

- [ ] **Step 2: Update `SymptomsContext` — data scope + update/remove methods**

Replace the full contents of `src/contexts/SymptomsContext.jsx` with:

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

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors/warnings.

- [ ] **Step 4: Manual smoke check (Dashboard unaffected)**

With both dev servers running (`npm run dev` in `server/`, `npm run dev` in the root) and a logged-in session, open the Dashboard and confirm the "Síntomas (7 días)" metric and the "Patrón de síntomas (7 días)" chart still render correctly (they now compute over up to 100 most recent symptoms instead of a server-side 7-day-filtered set — values should be unchanged for any account with fewer than 100 total symptoms in the last 7 days, which is the expected case).

- [ ] **Step 5: Commit**

```bash
git add src/api/symptoms.js src/contexts/SymptomsContext.jsx
git commit -m "feat: add symptom update/remove to API and context, widen fetch to 100 most recent"
```

---

### Task 3: Symptoms — `SymptomFormModal` edit mode

**Files:**
- Modify: `src/components/symptoms/SymptomFormModal.jsx` (full file)

**Interfaces:**
- Consumes: `updateSymptom(id, data)` from `SymptomsContext` (Task 2).
- Produces: `SymptomFormModal({ open, onClose, editItem = null })` — when `editItem` is a symptom object, the modal preloads its fields, titles itself "Editar síntoma", and calls `updateSymptom` on save. When `editItem` is `null` (default), behavior is identical to before this task.

- [ ] **Step 1: Add edit-mode support**

Replace the full contents of `src/components/symptoms/SymptomFormModal.jsx` with:

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

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors/warnings.

- [ ] **Step 3: Manual smoke check (Dashboard create flow unaffected)**

On the Dashboard, open the FAB → "Síntoma" (this calls `SymptomFormModal` without `editItem`) → confirm it still opens titled "Registrar síntoma", creates correctly, and the button reads "Guardar" (not "Guardar cambios").

- [ ] **Step 4: Commit**

```bash
git add src/components/symptoms/SymptomFormModal.jsx
git commit -m "feat: add edit mode to SymptomFormModal via optional editItem prop"
```

---

### Task 4: Symptoms — `SymptomsList` component (full listing)

**Files:**
- Create: `src/components/symptoms/SymptomsList.jsx`

**Interfaces:**
- Produces: `SymptomsList({ symptoms, onEdit, onDelete })` — default export. Renders one row per symptom (datetime + intensity as primary text, description as secondary), with Edit (`✏️`) and Delete (`🗑️`) icon buttons per row calling `onEdit(symptom)`/`onDelete(symptom)`. Empty state: "No hay síntomas registrados."
- Consumes: nothing from other tasks (pure presentational component, takes data via props).

- [ ] **Step 1: Create the component**

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

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors/warnings.

- [ ] **Step 3: Commit**

```bash
git add src/components/symptoms/SymptomsList.jsx
git commit -m "feat: add SymptomsList component for the full symptoms listing page"
```

---

### Task 5: Symptoms — `Sintomas.jsx` page wiring

**Files:**
- Modify: `src/pages/Sintomas.jsx` (full file, replaces the stub)

**Interfaces:**
- Consumes: `useSymptoms()` → `symptoms`, `removeSymptom` (Task 2); `SymptomFormModal` with `editItem` (Task 3); `SymptomsList` (Task 4); `ConfirmDialog` (Task 1); `useNotification()` → `notifyError`, `notifySuccess` (existing).
- Produces: fully functional `/sintomas` page — nothing else depends on this.

- [ ] **Step 1: Replace the stub page**

Replace the full contents of `src/pages/Sintomas.jsx` with:

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

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors/warnings.

- [ ] **Step 3: Manual verification**

With both dev servers running and logged in, navigate to `/sintomas`:
- Confirm all existing symptoms are listed (fecha, descripción, intensidad).
- Click the "+" FAB → create a new symptom → confirm it appears in the list.
- Click ✏️ on a row → confirm the modal opens titled "Editar síntoma" with that symptom's data preloaded → change the description → "Guardar cambios" → confirm the list reflects the change.
- Click 🗑️ on a row → confirm `ConfirmDialog` opens → confirm → confirm the row disappears and a success snackbar shows.
- Try opening the create modal with the description field empty → confirm "Guardar" stays disabled.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Sintomas.jsx
git commit -m "feat: wire full CRUD into the /sintomas page"
```

---

### Task 6: Medications — API + Context (update/remove)

**Files:**
- Modify: `src/api/medications.js` (full file)
- Modify: `src/contexts/MedicationsContext.jsx` (full file)

**Interfaces:**
- Produces (`src/api/medications.js`): `updateMedication(id, payload)` → PUT, returns updated medication. `deleteMedication(id)` → DELETE.
- Produces (`MedicationsContext` value): `updateMedication(id, data)` → calls API, merges the response with the existing item's `takenToday` flag (the PUT response doesn't know about it — it's a frontend-only annotation from `getMedicationLogs`), replaces the item in `medications`, throws on error. `removeMedication(id)` → calls API, filters the item out, throws on error. Existing `medications`, `toggleTaken`, `addMedication`, `todayAdherence`, `loading` unchanged in shape.
- Consumes: nothing from other tasks.

- [ ] **Step 1: Add `updateMedication`/`deleteMedication` to the API layer**

Replace the full contents of `src/api/medications.js` with:

```js
import client from './client';

export async function getMedications(params = {}) {
  const { data } = await client.get('/medications', { params });
  return data;
}

export async function getMedicationLogs(id, params = {}) {
  const { data } = await client.get(`/medications/${id}/logs`, { params });
  return data;
}

export async function upsertMedicationLog(id, payload) {
  const { data } = await client.post(`/medications/${id}/logs`, payload);
  return data;
}

export async function createMedication(payload) {
  const { data } = await client.post('/medications', payload);
  return data;
}

export async function updateMedication(id, payload) {
  const { data } = await client.put(`/medications/${id}`, payload);
  return data;
}

export async function deleteMedication(id) {
  await client.delete(`/medications/${id}`);
}
```

- [ ] **Step 2: Update `MedicationsContext` — update/remove methods**

Replace the full contents of `src/contexts/MedicationsContext.jsx` with:

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

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors/warnings.

- [ ] **Step 4: Commit**

```bash
git add src/api/medications.js src/contexts/MedicationsContext.jsx
git commit -m "feat: add medication update/remove to API and context"
```

---

### Task 7: Medications — `MedicationFormModal` edit mode

**Files:**
- Modify: `src/components/medications/MedicationFormModal.jsx` (full file)

**Interfaces:**
- Consumes: `updateMedication(id, data)` from `MedicationsContext` (Task 6).
- Produces: `MedicationFormModal({ open, onClose, editItem = null })` — same contract pattern as `SymptomFormModal` (Task 3).

- [ ] **Step 1: Add edit-mode support**

Replace the full contents of `src/components/medications/MedicationFormModal.jsx` with:

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

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors/warnings.

- [ ] **Step 3: Manual smoke check (Dashboard create flow unaffected)**

On the Dashboard, open the FAB → "Medicamento" → confirm it still opens titled "Registrar medicamento" and creates correctly.

- [ ] **Step 4: Commit**

```bash
git add src/components/medications/MedicationFormModal.jsx
git commit -m "feat: add edit mode to MedicationFormModal via optional editItem prop"
```

---

### Task 8: Medications — `MedicationsList` component (full listing)

**Files:**
- Create: `src/components/medications/MedicationsList.jsx`

**Interfaces:**
- Produces: `MedicationsList({ medications, onEdit, onDelete })` — default export. Renders one row per medication (name + dosage as primary, frequency as secondary), Edit/Delete icon buttons. Empty state: "No hay medicamentos registrados." This file is distinct from `src/components/dashboard/MedicationsList.jsx` (different folder, different responsibility — that one stays untouched).
- Consumes: nothing from other tasks.

- [ ] **Step 1: Create the component**

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

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors/warnings.

- [ ] **Step 3: Commit**

```bash
git add src/components/medications/MedicationsList.jsx
git commit -m "feat: add MedicationsList component for the full medications listing page"
```

---

### Task 9: Medications — `Medicamentos.jsx` page wiring

**Files:**
- Modify: `src/pages/Medicamentos.jsx` (full file, replaces the stub)

**Interfaces:**
- Consumes: `useMedications()` → `medications`, `removeMedication` (Task 6); `MedicationFormModal` with `editItem` (Task 7); `MedicationsList` (Task 8); `ConfirmDialog` (Task 1); `useNotification()` → `notifyError`, `notifySuccess` (existing).
- Produces: fully functional `/medicamentos` page — nothing else depends on this.

- [ ] **Step 1: Replace the stub page**

Replace the full contents of `src/pages/Medicamentos.jsx` with:

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

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors/warnings.

- [ ] **Step 3: Manual verification**

With both dev servers running and logged in, navigate to `/medicamentos`:
- Confirm all existing medications are listed (nombre, dosis, frecuencia).
- Create, edit (change dosage), and delete a medication — confirm the list updates each time and a success snackbar shows on delete.
- On the Dashboard, mark a medication as "tomado hoy", then go to `/medicamentos` and edit that medication's name → save → go back to the Dashboard and confirm the checkbox is still checked (i.e. `takenToday` survived the edit).

- [ ] **Step 4: Commit**

```bash
git add src/pages/Medicamentos.jsx
git commit -m "feat: wire full CRUD into the /medicamentos page"
```

---

### Task 10: Appointments — API + Context (update/remove + limit bump)

**Files:**
- Modify: `src/api/appointments.js` (full file)
- Modify: `src/contexts/AppointmentsContext.jsx` (full file)

**Interfaces:**
- Produces (`src/api/appointments.js`): `updateAppointment(id, payload)` → PUT, returns updated appointment. `deleteAppointment(id)` → DELETE.
- Produces (`AppointmentsContext` value): `updateAppointment(id, data)` → calls API, replaces item in `appointments`, throws on error. `removeAppointment(id)` → calls API, filters item out, throws on error. Existing `appointments`, `nextAppointment`, `addAppointment`, `loading` unchanged in shape; `appointments` now sourced from a `limit: 100` fetch instead of the server default of 20.
- Consumes: nothing from other tasks.

- [ ] **Step 1: Add `updateAppointment`/`deleteAppointment` to the API layer**

Replace the full contents of `src/api/appointments.js` with:

```js
import client from './client';

export async function getAppointments(params = {}) {
  const { data } = await client.get('/appointments', { params });
  return data;
}

export async function createAppointment(payload) {
  const { data } = await client.post('/appointments', payload);
  return data;
}

export async function updateAppointment(id, payload) {
  const { data } = await client.put(`/appointments/${id}`, payload);
  return data;
}

export async function deleteAppointment(id) {
  await client.delete(`/appointments/${id}`);
}
```

- [ ] **Step 2: Update `AppointmentsContext` — limit bump + update/remove methods**

Replace the full contents of `src/contexts/AppointmentsContext.jsx` with:

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

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors/warnings.

- [ ] **Step 4: Commit**

```bash
git add src/api/appointments.js src/contexts/AppointmentsContext.jsx
git commit -m "feat: add appointment update/remove to API and context, widen fetch to 100"
```

---

### Task 11: Appointments — `AppointmentFormModal` edit mode

**Files:**
- Modify: `src/components/appointments/AppointmentFormModal.jsx` (full file)

**Interfaces:**
- Consumes: `updateAppointment(id, data)` from `AppointmentsContext` (Task 10).
- Produces: `AppointmentFormModal({ open, onClose, editItem = null })` — same contract pattern as `SymptomFormModal` (Task 3).

- [ ] **Step 1: Add edit-mode support**

Replace the full contents of `src/components/appointments/AppointmentFormModal.jsx` with:

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

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors/warnings.

- [ ] **Step 3: Manual smoke check (Dashboard create flow unaffected)**

On the Dashboard, open the FAB → "Cita" → confirm it still opens titled "Registrar cita" and creates correctly.

- [ ] **Step 4: Commit**

```bash
git add src/components/appointments/AppointmentFormModal.jsx
git commit -m "feat: add edit mode to AppointmentFormModal via optional editItem prop"
```

---

### Task 12: Appointments — `AppointmentsList` component (full listing)

**Files:**
- Create: `src/components/appointments/AppointmentsList.jsx`

**Interfaces:**
- Produces: `AppointmentsList({ appointments, onEdit, onDelete })` — default export. Renders one row per appointment (doctor + specialty as primary, datetime + location as secondary), Edit/Delete icon buttons. Empty state: "No hay citas registradas." Unlike the Dashboard's widget, this renders **all** appointments, not just upcoming ones. This file is distinct from `src/components/dashboard/AppointmentsList.jsx` (different folder, different responsibility — that one stays untouched).
- Consumes: nothing from other tasks.

- [ ] **Step 1: Create the component**

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

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors/warnings.

- [ ] **Step 3: Commit**

```bash
git add src/components/appointments/AppointmentsList.jsx
git commit -m "feat: add AppointmentsList component for the full appointments listing page"
```

---

### Task 13: Appointments — `Citas.jsx` page wiring

**Files:**
- Modify: `src/pages/Citas.jsx` (full file, replaces the stub)

**Interfaces:**
- Consumes: `useAppointments()` → `appointments`, `removeAppointment` (Task 10); `AppointmentFormModal` with `editItem` (Task 11); `AppointmentsList` (Task 12); `ConfirmDialog` (Task 1); `useNotification()` → `notifyError`, `notifySuccess` (existing).
- Produces: fully functional `/citas` page — nothing else depends on this.

- [ ] **Step 1: Replace the stub page**

Replace the full contents of `src/pages/Citas.jsx` with:

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

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors/warnings.

- [ ] **Step 3: Manual verification**

With both dev servers running and logged in, navigate to `/citas`:
- Confirm **all** appointments are listed (doctor, especialidad, fecha, ubicación) — including any in the past, unlike the Dashboard's "Próximas citas" widget.
- Create, edit (change the date to one further in the future than any existing appointment), and delete an appointment — confirm the list updates each time.
- After editing an appointment's date to be the soonest upcoming one, go to the Dashboard and confirm "Próxima cita" reflects it.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Citas.jsx
git commit -m "feat: wire full CRUD into the /citas page"
```

---

### Task 14: Full end-to-end verification across all three pages

**Files:** none (verification only).

**Interfaces:** Consumes the fully assembled feature from Tasks 1–13.

- [ ] **Step 1: Start both dev servers**

```bash
cd server && npm run dev
```

(in a second terminal, from repo root)

```bash
npm run dev
```

- [ ] **Step 2: Full manual walkthrough**

Log in and, for each of `/sintomas`, `/medicamentos`, `/citas`:
1. Confirm the listing shows every existing record with the fields specified in the design spec.
2. Create a new record via the page's own "+" FAB.
3. Edit that record and confirm the change is reflected in the list without a page reload.
4. Delete that record, confirm the `ConfirmDialog` appears, confirm deletion, and confirm the record disappears with a success snackbar.
5. Confirm canceling a delete (clicking "Cancelar" in the dialog) leaves the record intact.

Then re-visit the Dashboard and confirm no regressions: síntomas chart/metric, medicamentos adherence checkbox, "Próxima cita" metric, and the FAB's three create actions all still work exactly as before this feature.

- [ ] **Step 3: Run lint one final time on the full branch diff**

Run: `npm run lint`
Expected: 0 errors, no new warnings beyond what existed on `master` before this branch.

- [ ] **Step 4: Record verification results**

No commit needed for this task — if all checks pass, proceed to the final whole-branch code review per `superpowers:subagent-driven-development`. If anything fails, fix it within the task whose file caused it, and re-run this task's checklist.
