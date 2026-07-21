# Dashboard + Registro de Síntomas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the placeholder Dashboard into a functional view backed by localStorage-persisted data (symptoms, medications, appointments), and let the user register new symptoms via a modal opened from a floating "+" button.

**Architecture:** Three domain Contexts (`SymptomsContext`, `MedicationsContext`, `AppointmentsContext`), each backed by a shared generic `useLocalStorage` hook, mirroring the existing `ThemeContext.jsx` pattern. Each Context seeds mock data into its own `localStorage` key on first load and exposes a small selector (`last7Days`, `todayAdherence`, `nextAppointment`). Dashboard composes five presentational components fed by these Contexts; a `SymptomFormModal` (MUI `Dialog`) writes back through `addSymptom`.

**Tech Stack:** React 19, MUI v9 (`Dialog`, `Slider`, `SpeedDial`, `TextField`, `Grid`), recharts v3 (`LineChart`), react-router-dom v7, `window.localStorage`. No backend, no automated test runner in this project.

## Global Constraints

- Data model is fixed per the spec (verbatim):
  ```js
  // pulso.symptoms
  { id: string, datetime: string /* ISO */, description: string, intensity: 1|2|3|4|5 }
  // pulso.medications
  { id: string, name: string, dose: string, time: string /* "HH:mm" */, takenDates: string[] }
  // pulso.appointments
  { id: string, doctor: string, specialty: string, datetime: string /* ISO */, location: string }
  ```
- Corrupted/missing `localStorage` value → treat as absent, regenerate mock seed, never throw.
- No backend, no loading states, no network validation (spec: "Fuera de alcance").
- No editing/deleting symptoms; FAB's "Medicamento"/"Cita" actions are disabled placeholders with a "Próximamente" tooltip.
- **No automated test suite exists in this project** (confirmed in `package.json` — no Vitest/Jest). Per the approved spec and the user's explicit choice, verification is **manual only**: run the Vite dev server and drive it with `playwright-core` (already installed in this project, see prior verification script), checking rendered output and `console`/`pageerror` events instead of writing unit tests. Every task below ends with a manual verification step in place of an automated test.
- Follow existing patterns: MUI theme tokens from `src/contexts/ThemeContext.jsx` (primary `#0E7C86`, `Plus Jakarta Sans` for headings), functional components, no class components, Spanish UI copy throughout.

---

## Task 1: `useLocalStorage` generic hook

**Files:**
- Create: `src/hooks/useLocalStorage.js`

**Interfaces:**
- Produces: `useLocalStorage(key: string, initialValue: T | (() => T)) => [T, React.Dispatch<React.SetStateAction<T>>]` — same call shape as `useState`, but the returned value is read from/written to `window.localStorage[key]` as JSON. If `initialValue` is a function it's only invoked when nothing valid is stored (lazy, matches `useState`'s lazy-init convention so mock seeds using "today" stay fresh).

- [ ] **Step 1: Create the hook**

```js
// src/hooks/useLocalStorage.js
import { useEffect, useState } from 'react';

export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored === null) {
        return typeof initialValue === 'function' ? initialValue() : initialValue;
      }
      return JSON.parse(stored);
    } catch {
      return typeof initialValue === 'function' ? initialValue() : initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // localStorage no disponible (ej. modo privado) — el estado sigue funcionando en memoria
    }
  }, [key, value]);

  return [value, setValue];
}
```

- [ ] **Step 2: Manual verification**

There's no consumer yet, so verify by static check only: read the file back and confirm it exports `useLocalStorage` and imports resolve (`react`). No dev server check needed until Task 2 gives it a consumer.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useLocalStorage.js
git commit -m "feat: add generic useLocalStorage hook"
```

---

## Task 2: `SymptomsContext`

**Files:**
- Create: `src/contexts/SymptomsContext.jsx`

**Interfaces:**
- Consumes: `useLocalStorage(key, initialValue)` from Task 1 — `import { useLocalStorage } from '../hooks/useLocalStorage'`.
- Produces: `useSymptoms() => { symptoms: Symptom[], addSymptom(entry: {datetime, description, intensity}): void, last7Days: {date: string, label: string, avgIntensity: number|null}[] }` and `<SymptomsProvider>`. Later tasks (Dashboard, SymptomsChart, SymptomFormModal) rely on these exact names.

- [ ] **Step 1: Create the context**

```jsx
// src/contexts/SymptomsContext.jsx
import { createContext, useContext, useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

const STORAGE_KEY = 'pulso.symptoms';

function createId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function daysAgoISO(daysAgo, hour) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function seedSymptoms() {
  return [
    { id: createId(), datetime: daysAgoISO(6, 9), description: 'Dolor de cabeza leve', intensity: 2 },
    { id: createId(), datetime: daysAgoISO(5, 14), description: 'Náuseas después de comer', intensity: 3 },
    { id: createId(), datetime: daysAgoISO(3, 8), description: 'Fatiga general', intensity: 4 },
    { id: createId(), datetime: daysAgoISO(2, 20), description: 'Dolor articular', intensity: 3 },
    { id: createId(), datetime: daysAgoISO(1, 11), description: 'Mareo leve', intensity: 2 },
    { id: createId(), datetime: daysAgoISO(0, 7), description: 'Dolor de cabeza intenso', intensity: 5 },
  ];
}

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
  const [symptoms, setSymptoms] = useLocalStorage(STORAGE_KEY, seedSymptoms);

  const addSymptom = (entry) => {
    setSymptoms((prev) => [...prev, { id: createId(), ...entry }]);
  };

  const last7Days = useMemo(() => computeLast7Days(symptoms), [symptoms]);

  const value = useMemo(() => ({ symptoms, addSymptom, last7Days }), [symptoms, last7Days]);

  return <SymptomsContext.Provider value={value}>{children}</SymptomsContext.Provider>;
}

export function useSymptoms() {
  const ctx = useContext(SymptomsContext);
  if (!ctx) throw new Error('useSymptoms debe usarse dentro de SymptomsProvider');
  return ctx;
}
```

- [ ] **Step 2: Manual verification (deferred)**

This Context has no consumer until Task 5 wires it into `App.jsx`. Confirm only that the file has no syntax errors by running `npx vite build --mode development 2>&1 | head -n 20` is unnecessary at this stage — skip to Task 5's dev-server check, which will exercise this file for real.

- [ ] **Step 3: Commit**

```bash
git add src/contexts/SymptomsContext.jsx
git commit -m "feat: add SymptomsContext with mock seed and last7Days selector"
```

---

## Task 3: `MedicationsContext`

**Files:**
- Create: `src/contexts/MedicationsContext.jsx`

**Interfaces:**
- Consumes: `useLocalStorage` from Task 1.
- Produces: `useMedications() => { medications: Medication[], toggleTaken(id: string, date: string): void, todayAdherence: number|null }` and `<MedicationsProvider>`. `todayAdherence` is `null` when there are no medications at all (UI must render "N/A" for `null`, never `0%` in that case) — later Dashboard task relies on this `null` sentinel.

- [ ] **Step 1: Create the context**

```jsx
// src/contexts/MedicationsContext.jsx
import { createContext, useContext, useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

const STORAGE_KEY = 'pulso.medications';

function createId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function seedMedications() {
  return [
    { id: createId(), name: 'Losartán', dose: '50mg', time: '08:00', takenDates: [] },
    { id: createId(), name: 'Metformina', dose: '850mg', time: '13:00', takenDates: [] },
    { id: createId(), name: 'Atorvastatina', dose: '20mg', time: '21:00', takenDates: [] },
  ];
}

const MedicationsContext = createContext(null);

export function MedicationsProvider({ children }) {
  const [medications, setMedications] = useLocalStorage(STORAGE_KEY, seedMedications);

  const toggleTaken = (id, date) => {
    setMedications((prev) =>
      prev.map((med) => {
        if (med.id !== id) return med;
        const taken = med.takenDates.includes(date);
        return {
          ...med,
          takenDates: taken ? med.takenDates.filter((d) => d !== date) : [...med.takenDates, date],
        };
      })
    );
  };

  const todayAdherence = useMemo(() => {
    if (medications.length === 0) return null;
    const today = todayKey();
    const takenCount = medications.filter((med) => med.takenDates.includes(today)).length;
    return Math.round((takenCount / medications.length) * 100);
  }, [medications]);

  const value = useMemo(
    () => ({ medications, toggleTaken, todayAdherence }),
    [medications, todayAdherence]
  );

  return <MedicationsContext.Provider value={value}>{children}</MedicationsContext.Provider>;
}

export function useMedications() {
  const ctx = useContext(MedicationsContext);
  if (!ctx) throw new Error('useMedications debe usarse dentro de MedicationsProvider');
  return ctx;
}
```

- [ ] **Step 2: Manual verification (deferred)**

No consumer yet — verified for real in Task 5's dev-server check.

- [ ] **Step 3: Commit**

```bash
git add src/contexts/MedicationsContext.jsx
git commit -m "feat: add MedicationsContext with mock seed and todayAdherence selector"
```

---

## Task 4: `AppointmentsContext`

**Files:**
- Create: `src/contexts/AppointmentsContext.jsx`

**Interfaces:**
- Consumes: `useLocalStorage` from Task 1.
- Produces: `useAppointments() => { appointments: Appointment[], nextAppointment: Appointment|null }` and `<AppointmentsProvider>`.

- [ ] **Step 1: Create the context**

```jsx
// src/contexts/AppointmentsContext.jsx
import { createContext, useContext, useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

const STORAGE_KEY = 'pulso.appointments';

function createId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function daysFromNowISO(days, hour) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function seedAppointments() {
  return [
    {
      id: createId(),
      doctor: 'Dra. Elena Ruiz',
      specialty: 'Medicina general',
      datetime: daysFromNowISO(-5, 10),
      location: 'Clínica Central, consultorio 3',
    },
    {
      id: createId(),
      doctor: 'Dr. Marco Vidal',
      specialty: 'Cardiología',
      datetime: daysFromNowISO(9, 16),
      location: 'Centro Médico Norte, piso 2',
    },
  ];
}

const AppointmentsContext = createContext(null);

export function AppointmentsProvider({ children }) {
  const [appointments] = useLocalStorage(STORAGE_KEY, seedAppointments);

  const nextAppointment = useMemo(() => {
    const now = Date.now();
    const future = appointments
      .filter((a) => new Date(a.datetime).getTime() >= now)
      .sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
    return future.length > 0 ? future[0] : null;
  }, [appointments]);

  const value = useMemo(() => ({ appointments, nextAppointment }), [appointments, nextAppointment]);

  return <AppointmentsContext.Provider value={value}>{children}</AppointmentsContext.Provider>;
}

export function useAppointments() {
  const ctx = useContext(AppointmentsContext);
  if (!ctx) throw new Error('useAppointments debe usarse dentro de AppointmentsProvider');
  return ctx;
}
```

- [ ] **Step 2: Manual verification (deferred)**

No consumer yet — verified for real in Task 5's dev-server check.

- [ ] **Step 3: Commit**

```bash
git add src/contexts/AppointmentsContext.jsx
git commit -m "feat: add AppointmentsContext with mock seed and nextAppointment selector"
```

---

## Task 5: Wire providers into `App.jsx`

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `SymptomsProvider` (Task 2), `MedicationsProvider` (Task 3), `AppointmentsProvider` (Task 4).
- Produces: all three domain hooks (`useSymptoms`, `useMedications`, `useAppointments`) become callable from any route component.

- [ ] **Step 1: Update `App.jsx`**

```jsx
// src/App.jsx
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import Box from '@mui/material/Box';
import { AppThemeProvider } from './contexts/ThemeContext';
import { SymptomsProvider } from './contexts/SymptomsContext';
import { MedicationsProvider } from './contexts/MedicationsContext';
import { AppointmentsProvider } from './contexts/AppointmentsContext';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Sintomas from './pages/Sintomas';
import Medicamentos from './pages/Medicamentos';
import Citas from './pages/Citas';

function Layout() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Navbar />
      <Outlet />
    </Box>
  );
}

function App() {
  return (
    <AppThemeProvider>
      <SymptomsProvider>
        <MedicationsProvider>
          <AppointmentsProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route element={<Layout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/sintomas" element={<Sintomas />} />
                  <Route path="/medicamentos" element={<Medicamentos />} />
                  <Route path="/citas" element={<Citas />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </AppointmentsProvider>
        </MedicationsProvider>
      </SymptomsProvider>
    </AppThemeProvider>
  );
}

export default App;
```

- [ ] **Step 2: Manual verification**

Start the dev server if not already running (`npm run dev`, poll `http://localhost:5173` until it responds), then drive it headlessly:

```bash
node -e "
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  console.log('errors:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
})();
"
```

Expected: `errors: none` (Dashboard still shows the old placeholder UI — that's fine, this task only proves the providers mount without throwing).

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire Symptoms/Medications/Appointments providers into App"
```

---

## Task 6: `MetricCard` component

**Files:**
- Create: `src/components/dashboard/MetricCard.jsx`

**Interfaces:**
- Produces: `<MetricCard label={string} value={string|number} color?={string} />` — reusable, no Context dependency. Task 12 (Dashboard) relies on this exact prop shape.

- [ ] **Step 1: Create the component**

```jsx
// src/components/dashboard/MetricCard.jsx
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
```

- [ ] **Step 2: Manual verification (deferred)**

No route renders it yet — verified visually in Task 12.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/MetricCard.jsx
git commit -m "feat: add reusable MetricCard component"
```

---

## Task 7: `SymptomsChart` component

**Files:**
- Create: `src/components/dashboard/SymptomsChart.jsx`

**Interfaces:**
- Consumes: a `data` prop shaped like `SymptomsContext`'s `last7Days` — `{ date: string, label: string, avgIntensity: number|null }[]`.
- Produces: `<SymptomsChart data={last7Days} />`. Renders "Aún no hay registros" when every entry's `avgIntensity` is `null`.

- [ ] **Step 1: Create the component**

```jsx
// src/components/dashboard/SymptomsChart.jsx
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
```

- [ ] **Step 2: Manual verification (deferred)**

Verified visually in Task 12 alongside the real `last7Days` data.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/SymptomsChart.jsx
git commit -m "feat: add SymptomsChart with empty-state handling"
```

---

## Task 8: `MedicationsList` component

**Files:**
- Create: `src/components/dashboard/MedicationsList.jsx`

**Interfaces:**
- Consumes: `useMedications()` from Task 3 — `import { useMedications } from '../../contexts/MedicationsContext'`.
- Produces: `<MedicationsList />`, self-contained (no props), renders "No hay medicamentos programados para hoy." when `medications.length === 0`.

- [ ] **Step 1: Create the component**

```jsx
// src/components/dashboard/MedicationsList.jsx
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import { useMedications } from '../../contexts/MedicationsContext';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function MedicationsList() {
  const { medications, toggleTaken } = useMedications();
  const today = todayKey();

  if (medications.length === 0) {
    return <Typography color="text.secondary">No hay medicamentos programados para hoy.</Typography>;
  }

  return (
    <List disablePadding>
      {medications.map((med) => {
        const taken = med.takenDates.includes(today);
        return (
          <ListItemButton key={med.id} onClick={() => toggleTaken(med.id, today)} dense disableGutters>
            <ListItemIcon sx={{ minWidth: 40 }}>
              <Checkbox edge="start" checked={taken} tabIndex={-1} disableRipple />
            </ListItemIcon>
            <ListItemText
              primary={`${med.name} — ${med.dose}`}
              secondary={med.time}
              sx={{ textDecoration: taken ? 'line-through' : 'none' }}
            />
          </ListItemButton>
        );
      })}
    </List>
  );
}
```

- [ ] **Step 2: Manual verification (deferred)**

Verified visually in Task 12, including the interactive toggle.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/MedicationsList.jsx
git commit -m "feat: add interactive MedicationsList component"
```

---

## Task 9: `AppointmentsList` component

**Files:**
- Create: `src/components/dashboard/AppointmentsList.jsx`

**Interfaces:**
- Consumes: `useAppointments()` from Task 4 — `import { useAppointments } from '../../contexts/AppointmentsContext'`.
- Produces: `<AppointmentsList />`, self-contained, renders "Sin citas próximas." when there are no future appointments.

- [ ] **Step 1: Create the component**

```jsx
// src/components/dashboard/AppointmentsList.jsx
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { useAppointments } from '../../contexts/AppointmentsContext';

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AppointmentsList() {
  const { appointments } = useAppointments();
  const now = Date.now();
  const upcoming = appointments
    .filter((a) => new Date(a.datetime).getTime() >= now)
    .sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

  if (upcoming.length === 0) {
    return <Typography color="text.secondary">Sin citas próximas.</Typography>;
  }

  return (
    <List disablePadding>
      {upcoming.map((appt) => (
        <ListItem key={appt.id} disableGutters>
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

- [ ] **Step 2: Manual verification (deferred)**

Verified visually in Task 12.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/AppointmentsList.jsx
git commit -m "feat: add AppointmentsList component"
```

---

## Task 10: `SymptomFormModal` component

**Files:**
- Create: `src/components/symptoms/SymptomFormModal.jsx`

**Interfaces:**
- Consumes: `useSymptoms()` from Task 2 (`addSymptom`).
- Produces: `<SymptomFormModal open={boolean} onClose={() => void} />`. Task 12 (Dashboard) and Task 11 (FAB) rely on this exact prop shape — `open`/`onClose`, no other required props.

- [ ] **Step 1: Create the component**

```jsx
// src/components/symptoms/SymptomFormModal.jsx
import { useState } from 'react';
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

function nowForInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const marks = [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) }));
const intensityColors = { 1: '#3B8C5A', 2: '#8FB03E', 3: '#C6821F', 4: '#D85A30', 5: '#C0392B' };

export default function SymptomFormModal({ open, onClose }) {
  const { addSymptom } = useSymptoms();
  const [datetime, setDatetime] = useState(nowForInput);
  const [description, setDescription] = useState('');
  const [intensity, setIntensity] = useState(3);

  const isValid = description.trim().length > 0 && datetime.length > 0;

  const handleClose = () => {
    setDatetime(nowForInput());
    setDescription('');
    setIntensity(3);
    onClose();
  };

  const handleSave = () => {
    if (!isValid) return;
    addSymptom({
      datetime: new Date(datetime).toISOString(),
      description: description.trim(),
      intensity,
    });
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Registrar síntoma</DialogTitle>
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
        <Button onClick={handleClose}>Cancelar</Button>
        <Button onClick={handleSave} variant="contained" disabled={!isValid}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 2: Manual verification (deferred)**

Verified end-to-end (open, fill, save, Dashboard updates) in Task 12/13.

- [ ] **Step 3: Commit**

```bash
git add src/components/symptoms/SymptomFormModal.jsx
git commit -m "feat: add SymptomFormModal with datetime, description, and intensity slider"
```

---

## Task 11: `AddRecordFab` component

**Files:**
- Create: `src/components/dashboard/AddRecordFab.jsx`

**Interfaces:**
- Produces: `<AddRecordFab onAddSymptom={() => void} />`. A `SpeedDial` with three actions; only "Síntoma" is enabled and calls `onAddSymptom`. "Medicamento" and "Cita" are disabled with a "Próximamente" tooltip, per spec's explicit out-of-scope list.

- [ ] **Step 1: Create the component**

```jsx
// src/components/dashboard/AddRecordFab.jsx
import { useState } from 'react';
import SpeedDial from '@mui/material/SpeedDial';
import SpeedDialAction from '@mui/material/SpeedDialAction';

const actions = [
  { key: 'sintoma', icon: '🩺', name: 'Síntoma', disabled: false },
  { key: 'medicamento', icon: '💊', name: 'Medicamento', disabled: true },
  { key: 'cita', icon: '📅', name: 'Cita', disabled: true },
];

export default function AddRecordFab({ onAddSymptom }) {
  const [open, setOpen] = useState(false);

  const handleActionClick = (key) => {
    setOpen(false);
    if (key === 'sintoma') onAddSymptom();
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

- [ ] **Step 2: Manual verification (deferred)**

Verified visually/interactively in Task 12/13.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/AddRecordFab.jsx
git commit -m "feat: add AddRecordFab SpeedDial with Sintoma enabled and placeholders disabled"
```

---

## Task 12: Compose `Dashboard.jsx`

**Files:**
- Modify: `src/pages/Dashboard.jsx` (replace placeholder content entirely)

**Interfaces:**
- Consumes: `useSymptoms()` (Task 2), `useMedications()` (Task 3), `useAppointments()` (Task 4), `MetricCard` (Task 6), `SymptomsChart` (Task 7), `MedicationsList` (Task 8), `AppointmentsList` (Task 9), `SymptomFormModal` (Task 10), `AddRecordFab` (Task 11).
- Produces: the fully composed Dashboard page — no further consumers.

- [ ] **Step 1: Replace `Dashboard.jsx`**

```jsx
// src/pages/Dashboard.jsx
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
  const { symptoms, last7Days } = useSymptoms();
  const { todayAdherence } = useMedications();
  const { nextAppointment } = useAppointments();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentSymptomsCount = symptoms.filter((s) => new Date(s.datetime) >= sevenDaysAgo).length;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h1" sx={{ mb: 3 }}>
        Hola 👋
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

      <AddRecordFab onAddSymptom={() => setModalOpen(true)} />
      <SymptomFormModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </Box>
  );
}
```

- [ ] **Step 2: Manual verification**

With the dev server running, drive it headlessly and screenshot:

```bash
node -e "
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'dashboard.png', fullPage: true });
  console.log('errors:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
})();
"
```

Expected: `errors: none`, and `dashboard.png` shows 3 metric cards with real values (not `—`), a line chart with 7 points, a medications checklist, and an appointments list, plus a "+" FAB bottom-right.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Dashboard.jsx
git commit -m "feat: compose functional Dashboard from metrics, chart, lists, and FAB"
```

---

## Task 13: Full manual verification pass

**Files:** none (verification only)

**Interfaces:** none — this task exercises everything built in Tasks 1–12.

- [ ] **Step 1: Confirm dev server is running**

```bash
curl -sf http://localhost:5173 > /dev/null && echo "up" || npm run dev &
```

- [ ] **Step 2: Drive all routes and the add-symptom flow**

```bash
node -e "
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });

  for (const route of ['/', '/login', '/sintomas', '/medicamentos', '/citas']) {
    await page.goto('http://localhost:5173' + route, { waitUntil: 'networkidle' });
  }

  // Add a symptom end-to-end
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.click('[aria-label=\"Añadir registro\"]');
  await page.click('text=Síntoma');
  await page.fill('textarea[name], textarea', 'Verificación manual E2E');
  await page.click('text=Guardar');
  await page.waitForTimeout(300);

  // Toggle a medication
  const checkbox = await page.\$('input[type=checkbox]');
  if (checkbox) await checkbox.click();

  console.log('errors:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
})();
"
```

Expected: `errors: none` across every route and after both interactions.

- [ ] **Step 3: Confirm persistence**

Reload `/` in the same script (`page.reload({ waitUntil: 'networkidle' })`) and confirm the newly added symptom and the toggled medication state survive the reload (they're read back from `localStorage`). No commit for this task — it's a verification-only checkpoint confirming Tasks 1–12 integrate correctly.
