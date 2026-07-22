# Registro de Citas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable creating appointments from the Dashboard FAB, so a new appointment appears immediately in "Próximas citas" and updates the "Próxima cita" metric.

**Architecture:** Mirror the already-implemented medication registration pattern exactly: a `createAppointment` API function, an `addAppointment` method on `AppointmentsContext` that calls it and updates local state, a new `AppointmentFormModal` component (Dialog with 4 required text/datetime fields), FAB enablement, and Dashboard wiring. `AppointmentsContext.nextAppointment` is already a `useMemo` derived from the `appointments` array, and both the "Próxima cita" metric and `AppointmentsList` already consume it — no changes needed there.

**Tech Stack:** React 18, MUI v6, Axios (`src/api/client.js`), Vite. No frontend test runner exists — only `oxlint` (`npm run lint`). Verification is manual: run backend (`server/`, `npm run dev`) and frontend (`npm run dev`) together and walk through the UI.

## Global Constraints

- Ubicación is a **required** field in the frontend form (not optional) — confirmed to match the backend's `location: z.string().trim().min(1, ...)` validation in `server/src/schemas/appointment.schema.js`. This is a binding decision from the approved spec; do not make it optional.
- No backend changes. `POST /appointments` already accepts `{ doctor, specialty, datetime, location }` (all required) and returns the created appointment object directly, status 201 — confirmed by reading `server/src/controllers/appointments.controller.js`.
- `datetime` must be sent as an ISO 8601 string (`new Date(value).toISOString()`), matching `appointmentBodySchema`'s `z.string().datetime(...)`.
- Follow the exact component/context pattern already used by `MedicationFormModal` / `MedicationsContext.addMedication` (created earlier on this same branch) — do not introduce a different pattern.
- All work stays on the existing branch `feature/medications-registration-and-greeting`. Do not create a new branch. No git push, no PR — everything stays local, including commits.
- No new dependencies.

---

### Task 1: API function and context method for appointment creation

**Files:**
- Modify: `src/api/appointments.js` (currently 6 lines, only has `getAppointments`)
- Modify: `src/contexts/AppointmentsContext.jsx`

**Interfaces:**
- Consumes: existing `client` from `src/api/client.js` (already imported in `appointments.js`); existing `AppointmentsContext` shape `{ appointments, nextAppointment, loading }`.
- Produces: `createAppointment(payload)` — async function, `payload: { doctor: string, specialty: string, datetime: string (ISO 8601), location: string }`, returns the created appointment object (`{ id, userId, doctor, specialty, datetime, location, ... }`). `addAppointment(data)` — async context method with the same payload shape, returns `void`, throws on failure. Both are consumed by Task 2's `AppointmentFormModal`.

- [ ] **Step 1: Add `createAppointment` to `src/api/appointments.js`**

Replace the full file content with:

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
```

- [ ] **Step 2: Add `addAppointment` method to `AppointmentsContext`**

In `src/contexts/AppointmentsContext.jsx`, update the import on line 2 from:

```js
import { getAppointments } from '../api/appointments';
```

to:

```js
import { getAppointments, createAppointment } from '../api/appointments';
```

Then add the `addAppointment` method right after the `nextAppointment` `useMemo` block (after the closing `}, [appointments]);` on line 33) and before the `value` `useMemo`:

```js
  const addAppointment = async (data) => {
    const created = await createAppointment(data);
    setAppointments((prev) => [...prev, created]);
  };
```

Then update the `value` `useMemo` (lines 35-38) from:

```js
  const value = useMemo(
    () => ({ appointments, nextAppointment, loading }),
    [appointments, nextAppointment, loading]
  );
```

to:

```js
  const value = useMemo(
    () => ({ appointments, nextAppointment, addAppointment, loading }),
    [appointments, nextAppointment, loading]
  );
```

- [ ] **Step 3: Verify with lint**

Run: `npm run lint`
Expected: no new errors or warnings in `src/api/appointments.js` or `src/contexts/AppointmentsContext.jsx`.

- [ ] **Step 4: Manual smoke check**

Run: `npm run dev` (frontend) and `npm run dev` in `server/` (backend). Log in to the app. Open the browser devtools console and run:

```js
// paste in browser console while logged in and on the Dashboard
window.__test = true;
```

This step is just to confirm the app still loads with no console errors after the context change (no functional UI to test yet — the modal comes in Task 2). Confirm the Dashboard renders normally and "Próximas citas" still shows existing appointments unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/api/appointments.js src/contexts/AppointmentsContext.jsx
git commit -m "feat: add createAppointment API function and AppointmentsContext.addAppointment"
```

---

### Task 2: AppointmentFormModal component

**Files:**
- Create: `src/components/appointments/AppointmentFormModal.jsx`

**Interfaces:**
- Consumes: `useAppointments()` from `src/contexts/AppointmentsContext.jsx` (Task 1) — specifically `addAppointment(data)`; `useNotification()` from `src/contexts/NotificationContext` — specifically `notifyError(message)`.
- Produces: default export `AppointmentFormModal` component with props `{ open: boolean, onClose: () => void }`. Consumed by Task 4's `Dashboard.jsx`.

- [ ] **Step 1: Create the component**

Create `src/components/appointments/AppointmentFormModal.jsx` with this exact content:

```jsx
import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import { useAppointments } from '../../contexts/AppointmentsContext';
import { useNotification } from '../../contexts/NotificationContext';

function nowForInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function AppointmentFormModal({ open, onClose }) {
  const { addAppointment } = useAppointments();
  const { notifyError } = useNotification();
  const [doctor, setDoctor] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [datetime, setDatetime] = useState(nowForInput);
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  const isValid =
    doctor.trim().length > 0 &&
    specialty.trim().length > 0 &&
    datetime.length > 0 &&
    location.trim().length > 0;

  const handleClose = () => {
    setDoctor('');
    setSpecialty('');
    setDatetime(nowForInput());
    setLocation('');
    onClose();
  };

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      await addAppointment({
        doctor: doctor.trim(),
        specialty: specialty.trim(),
        datetime: new Date(datetime).toISOString(),
        location: location.trim(),
      });
      handleClose();
    } catch (err) {
      notifyError(err.message || 'No se pudo guardar la cita');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Registrar cita</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
        <TextField
          label="Doctor"
          value={doctor}
          onChange={(e) => setDoctor(e.target.value)}
          fullWidth
          required
        />
        <TextField
          label="Especialidad"
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          fullWidth
          required
        />
        <TextField
          label="Fecha y hora"
          type="datetime-local"
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          fullWidth
          required
        />
        <TextField
          label="Ubicación"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
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

This mirrors `src/components/medications/MedicationFormModal.jsx` and `src/components/symptoms/SymptomFormModal.jsx` exactly in structure (state shape, `isValid`, `handleClose`, `handleSave` try/catch/finally, Dialog layout), reusing `nowForInput()` from `SymptomFormModal` for the datetime default so the field isn't empty on open.

- [ ] **Step 2: Verify with lint**

Run: `npm run lint`
Expected: no new errors or warnings in `src/components/appointments/AppointmentFormModal.jsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/appointments/AppointmentFormModal.jsx
git commit -m "feat: add AppointmentFormModal component"
```

---

### Task 3: Enable "Cita" action in AddRecordFab

**Files:**
- Modify: `src/components/dashboard/AddRecordFab.jsx`

**Interfaces:**
- Consumes: none new.
- Produces: `AddRecordFab` now accepts a third prop `onAddAppointment: () => void`, invoked when the user clicks the "Cita" FAB action. Consumed by Task 4's `Dashboard.jsx`.

- [ ] **Step 1: Enable the "cita" action and wire the new prop**

Replace the full content of `src/components/dashboard/AddRecordFab.jsx` with:

```jsx
import { useState } from 'react';
import SpeedDial from '@mui/material/SpeedDial';
import SpeedDialAction from '@mui/material/SpeedDialAction';

const actions = [
  { key: 'sintoma', icon: '🩺', name: 'Síntoma', disabled: false },
  { key: 'medicamento', icon: '💊', name: 'Medicamento', disabled: false },
  { key: 'cita', icon: '📅', name: 'Cita', disabled: false },
];

export default function AddRecordFab({ onAddSymptom, onAddMedication, onAddAppointment }) {
  const [open, setOpen] = useState(false);

  const handleActionClick = (key) => {
    setOpen(false);
    if (key === 'sintoma') onAddSymptom();
    if (key === 'medicamento') onAddMedication();
    if (key === 'cita') onAddAppointment();
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

- [ ] **Step 2: Verify with lint**

Run: `npm run lint`
Expected: no new errors or warnings in `src/components/dashboard/AddRecordFab.jsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/AddRecordFab.jsx
git commit -m "feat: enable Cita action in AddRecordFab"
```

---

### Task 4: Wire AppointmentFormModal into Dashboard

**Files:**
- Modify: `src/pages/Dashboard.jsx`

**Interfaces:**
- Consumes: `AppointmentFormModal` from `../components/appointments/AppointmentFormModal` (Task 2, props `{ open, onClose }`); `AddRecordFab`'s new `onAddAppointment` prop (Task 3).
- Produces: none (top-level page wiring; nothing downstream consumes `Dashboard.jsx`).

- [ ] **Step 1: Add the modal state, import, and wiring**

In `src/pages/Dashboard.jsx`, add the import after the existing `MedicationFormModal` import (line 13):

```jsx
import MedicationFormModal from '../components/medications/MedicationFormModal';
import AppointmentFormModal from '../components/appointments/AppointmentFormModal';
```

Add a new state hook after `medicationModalOpen` (line 29):

```jsx
  const [medicationModalOpen, setMedicationModalOpen] = useState(false);
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false);
```

Update the `<AddRecordFab>` call (lines 92-95) from:

```jsx
      <AddRecordFab
        onAddSymptom={() => setModalOpen(true)}
        onAddMedication={() => setMedicationModalOpen(true)}
      />
```

to:

```jsx
      <AddRecordFab
        onAddSymptom={() => setModalOpen(true)}
        onAddMedication={() => setMedicationModalOpen(true)}
        onAddAppointment={() => setAppointmentModalOpen(true)}
      />
```

Add the new modal render right after the existing `<MedicationFormModal ... />` (after line 100, before the closing `</Box>`):

```jsx
      <MedicationFormModal
        open={medicationModalOpen}
        onClose={() => setMedicationModalOpen(false)}
      />
      <AppointmentFormModal
        open={appointmentModalOpen}
        onClose={() => setAppointmentModalOpen(false)}
      />
```

- [ ] **Step 2: Verify with lint**

Run: `npm run lint`
Expected: no new errors or warnings in `src/pages/Dashboard.jsx`.

- [ ] **Step 3: Manual end-to-end verification**

Run: `npm run dev` in `server/` and `npm run dev` in the project root. Log in to the app.

1. Click the FAB (bottom-right "+") → confirm "Cita" is now enabled (not grayed out, no "(Próximamente)" tooltip).
2. Click "Cita" → confirm the "Registrar cita" modal opens with Doctor, Especialidad, Fecha y hora (pre-filled with current date/time), and Ubicación fields, and the "Guardar" button is disabled while any field is empty.
3. Fill in all four fields with a future date/time → click "Guardar" → confirm the modal closes and the new appointment appears immediately in "Próximas citas" without a page reload.
4. If the new appointment's date/time is the soonest among all appointments, confirm the "Próxima cita" metric card updates to show it.
5. Reload the page → confirm the new appointment persists (was actually saved to the backend, not just added client-side).
6. Confirm the personalized greeting ("Hola, [nombre] 👋") and medication registration (FAB → "Medicamento") still work with no regressions.

Expected: all six checks pass with no console errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Dashboard.jsx
git commit -m "feat: wire AppointmentFormModal into Dashboard"
```

