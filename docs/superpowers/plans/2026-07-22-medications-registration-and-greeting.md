# Registro de Medicamentos y Saludo Personalizado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable medication registration from the Dashboard FAB (name/dosage/frequency → `POST /medications`) and replace the generic Dashboard greeting with a personalized one using the authenticated user's name.

**Architecture:** Both features are pure frontend composition of existing, proven patterns — no new architectural decisions. Medication registration mirrors the existing `SymptomFormModal` + `SymptomsContext.addSymptom` flow exactly (controlled MUI modal → async context method → API call → local state update → `NotificationContext` error handling). The greeting is a one-line template change reading `user.name` from `useAuth()`.

**Tech Stack:** React, MUI (Dialog/TextField/Button/SpeedDial), React Context, axios (via existing `client.js`), no frontend test runner (only `oxlint`).

## Global Constraints

- Backend requires no changes — `POST /medications` already validates `name`, `dosage`, `frequency` as required strings.
- `Dashboard` is already behind `ProtectedRoute`; `user` is always populated there — no "unauthenticated" guard is needed for the greeting.
- The "Cita" FAB action remains disabled — out of scope.
- No automated frontend test runner exists (only `oxlint`) — verification for each task is lint + manual browser walkthrough, per the project's established pattern.
- No git push or PR creation — all commits stay local only.
- Follow the existing `SymptomFormModal` / `SymptomsContext.addSymptom` pattern exactly for the new modal and context method (same structure, same error-handling approach via `notifyError`).

---

### Task 1: `createMedication` API function + `MedicationsContext.addMedication`

**Files:**
- Modify: `src/api/medications.js`
- Modify: `src/contexts/MedicationsContext.jsx`

**Interfaces:**
- Produces: `createMedication(payload: {name, dosage, frequency}) => Promise<Medication>` (exported from `src/api/medications.js`)
- Produces: `addMedication(data: {name, dosage, frequency}) => Promise<void>` (exposed on `useMedications()` context value; throws on error, does not catch internally — caller must catch)

- [ ] **Step 1: Add `createMedication` to the API layer**

In `src/api/medications.js`, add this function after the existing `upsertMedicationLog`:

```js
export async function createMedication(payload) {
  const { data } = await client.post('/medications', payload);
  return data;
}
```

The full file should read:

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
```

- [ ] **Step 2: Add `addMedication` to `MedicationsContext`**

In `src/contexts/MedicationsContext.jsx`, update the import on line 2 to include `createMedication`:

```js
import { getMedications, getMedicationLogs, upsertMedicationLog, createMedication } from '../api/medications';
```

Add a new `addMedication` function after `toggleTaken` (after the closing brace of `toggleTaken`, before `todayAdherence`):

```js
  const addMedication = async (data) => {
    const created = await createMedication(data);
    setMedications((prev) => [...prev, { ...created, takenToday: false }]);
  };
```

Update the `value` `useMemo` to expose `addMedication`:

```js
  const value = useMemo(
    () => ({ medications, toggleTaken, addMedication, todayAdherence, loading }),
    [medications, todayAdherence, loading]
  );
```

(The dependency array intentionally omits `toggleTaken`/`addMedication` themselves, matching the existing pattern already used for `toggleTaken` in this file — not introducing a new lint issue, not fixing a pre-existing one out of scope.)

- [ ] **Step 3: Verify no new lint errors**

Run: `npm run lint` (from the project root, which runs `oxlint`)
Expected: No new errors or warnings introduced by these two files (any pre-existing warnings in `MedicationsContext.jsx` are unrelated and out of scope).

- [ ] **Step 4: Commit**

```bash
git add src/api/medications.js src/contexts/MedicationsContext.jsx
git commit -m "feat: add createMedication API call and MedicationsContext.addMedication"
```

---

### Task 2: `MedicationFormModal` component

**Files:**
- Create: `src/components/medications/MedicationFormModal.jsx`

**Interfaces:**
- Consumes: `useMedications().addMedication(data)` from Task 1; `useNotification().notifyError(message)` (existing, from `src/contexts/NotificationContext.jsx`)
- Produces: default-exported React component `MedicationFormModal({ open, onClose })`, rendered by Task 4.

- [ ] **Step 1: Create the modal component**

Create `src/components/medications/MedicationFormModal.jsx`:

```jsx
import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import { useMedications } from '../../contexts/MedicationsContext';
import { useNotification } from '../../contexts/NotificationContext';

export default function MedicationFormModal({ open, onClose }) {
  const { addMedication } = useMedications();
  const { notifyError } = useNotification();
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [saving, setSaving] = useState(false);

  const isValid = name.trim().length > 0 && dosage.trim().length > 0 && frequency.trim().length > 0;

  const handleClose = () => {
    setName('');
    setDosage('');
    setFrequency('');
    onClose();
  };

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      await addMedication({
        name: name.trim(),
        dosage: dosage.trim(),
        frequency: frequency.trim(),
      });
      handleClose();
    } catch (err) {
      notifyError(err.message || 'No se pudo guardar el medicamento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Registrar medicamento</DialogTitle>
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
        <Button onClick={handleClose}>Cancelar</Button>
        <Button onClick={handleSave} variant="contained" disabled={!isValid || saving}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify no new lint errors**

Run: `npm run lint`
Expected: No new errors or warnings for `src/components/medications/MedicationFormModal.jsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/medications/MedicationFormModal.jsx
git commit -m "feat: add MedicationFormModal component"
```

---

### Task 3: Enable the "Medicamento" FAB action

**Files:**
- Modify: `src/components/dashboard/AddRecordFab.jsx`

**Interfaces:**
- Produces: `AddRecordFab({ onAddSymptom, onAddMedication })` — new `onAddMedication` prop, called when the user clicks the "Medicamento" speed-dial action. Consumed by Task 4.

- [ ] **Step 1: Enable the action and wire the new prop**

Replace the full contents of `src/components/dashboard/AddRecordFab.jsx`:

```jsx
import { useState } from 'react';
import SpeedDial from '@mui/material/SpeedDial';
import SpeedDialAction from '@mui/material/SpeedDialAction';

const actions = [
  { key: 'sintoma', icon: '🩺', name: 'Síntoma', disabled: false },
  { key: 'medicamento', icon: '💊', name: 'Medicamento', disabled: false },
  { key: 'cita', icon: '📅', name: 'Cita', disabled: true },
];

export default function AddRecordFab({ onAddSymptom, onAddMedication }) {
  const [open, setOpen] = useState(false);

  const handleActionClick = (key) => {
    setOpen(false);
    if (key === 'sintoma') onAddSymptom();
    if (key === 'medicamento') onAddMedication();
  };

  return (
    <SpeedDial
      ariaLabel="Añadir registro"
      sx={{ position: 'fixed', bottom: 24, right: 24 }}
      icon={<span style={{ fontSize: 24, lineHeight: 1 }}>+</span>}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
    >
      {actions.map((action) => (
        <SpeedDialAction
          key={action.key}
          icon={<span style={{ fontSize: 20 }}>{action.icon}</span>}
          slotProps={{
            tooltip: {
              title: action.disabled ? `${action.name} (Próximamente)` : action.name,
              open: true,
            },
            fab: { disabled: action.disabled },
          }}
          onClick={() => handleActionClick(action.key)}
        />
      ))}
    </SpeedDial>
  );
}
```

- [ ] **Step 2: Verify no new lint errors**

Run: `npm run lint`
Expected: No new errors or warnings for `src/components/dashboard/AddRecordFab.jsx`.

Note: `Dashboard.jsx` does not yet pass `onAddMedication` (that's Task 4) — do not manually click "Medicamento" in the browser yet, it would throw since the prop is undefined until Task 4 wires it.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/AddRecordFab.jsx
git commit -m "feat: enable Medicamento FAB action"
```

---

### Task 4: Wire the modal into Dashboard + personalized greeting

**Files:**
- Modify: `src/pages/Dashboard.jsx`

**Interfaces:**
- Consumes: `MedicationFormModal` (Task 2), `AddRecordFab`'s `onAddMedication` prop (Task 3), `useAuth()` from `src/contexts/AuthContext.jsx` (existing — returns `{ user, ... }` where `user` is `{id, name, email}`).

- [ ] **Step 1: Add imports, modal state, FAB wiring, modal render, and personalized greeting**

In `src/pages/Dashboard.jsx`, update the imports at the top (after line 12, `import SymptomFormModal from '../components/symptoms/SymptomFormModal';`) to add:

```js
import MedicationFormModal from '../components/medications/MedicationFormModal';
import { useAuth } from '../contexts/AuthContext';
```

Update the component body — replace:

```jsx
export default function Dashboard() {
  const [modalOpen, setModalOpen] = useState(false);
  const { symptoms, last7Days } = useSymptoms();
  const { todayAdherence } = useMedications();
  const { nextAppointment } = useAppointments();
```

with:

```jsx
export default function Dashboard() {
  const [modalOpen, setModalOpen] = useState(false);
  const [medicationModalOpen, setMedicationModalOpen] = useState(false);
  const { user } = useAuth();
  const { symptoms, last7Days } = useSymptoms();
  const { todayAdherence } = useMedications();
  const { nextAppointment } = useAppointments();
```

Replace the greeting:

```jsx
      <Typography variant="h1" sx={{ mb: 3 }}>
        Hola 👋
      </Typography>
```

with:

```jsx
      <Typography variant="h1" sx={{ mb: 3 }}>
        Hola, {user.name} 👋
      </Typography>
```

Replace the FAB and modal render at the bottom:

```jsx
      <AddRecordFab onAddSymptom={() => setModalOpen(true)} />
      <SymptomFormModal open={modalOpen} onClose={() => setModalOpen(false)} />
```

with:

```jsx
      <AddRecordFab
        onAddSymptom={() => setModalOpen(true)}
        onAddMedication={() => setMedicationModalOpen(true)}
      />
      <SymptomFormModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <MedicationFormModal
        open={medicationModalOpen}
        onClose={() => setMedicationModalOpen(false)}
      />
```

- [ ] **Step 2: Verify no new lint errors**

Run: `npm run lint`
Expected: No new errors or warnings for `src/pages/Dashboard.jsx`.

- [ ] **Step 3: Manual end-to-end verification**

1. Start the backend: `npm run dev` in `server/`.
2. Start the frontend: `npm run dev` in the project root.
3. Log in to the app.
4. Confirm the Dashboard greeting shows "Hola, [nombre real del usuario] 👋".
5. Click the FAB (+) → confirm "Medicamento" is no longer disabled (no "(Próximamente)" tooltip suffix).
6. Click "Medicamento", fill in Nombre/Dosis/Frecuencia, click "Guardar" → confirm the modal closes and the new medication appears immediately in "Medicamentos de hoy" without a page reload.
7. Click the "tomado" checkbox on the new medication → confirm it shows as checked/struck-through, and reload the page to confirm it persists.
8. Confirm the "Cita" FAB action is still disabled.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Dashboard.jsx
git commit -m "feat: wire medication modal into Dashboard and personalize greeting"
```

---

## Self-Review Notes

- **Spec coverage:** All 5 spec components map to tasks — `createMedication` (Task 1), `addMedication` (Task 1), `MedicationFormModal` (Task 2), `AddRecordFab` (Task 3), `Dashboard` wiring + greeting (Task 4). `MedicationsList.jsx` requires no changes, per spec — confirmed no task touches it.
- **Placeholder scan:** No TBD/TODO; every step has complete, runnable code.
- **Type/signature consistency:** `addMedication({name, dosage, frequency})` signature in Task 1 matches the call site in Task 2's `MedicationFormModal`. `onAddMedication` prop name is consistent between Task 3 (`AddRecordFab`) and Task 4 (`Dashboard`). `MedicationFormModal({ open, onClose })` prop names match between Task 2's definition and Task 4's render.
