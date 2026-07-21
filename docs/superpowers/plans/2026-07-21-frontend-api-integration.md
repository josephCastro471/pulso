# Frontend ↔ API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `localStorage` as the persistence layer in the Pulso frontend with real calls to the already-implemented backend API (`server/`), add login/registration, protect authenticated routes, and surface API errors in a global notification.

**Architecture:** A new `src/api/` layer wraps a single axios instance (request interceptor attaches the JWT, response interceptor normalizes errors and handles 401 session expiry). A new `AuthContext` owns login/register/logout and mount-time token validation. The three existing domain contexts (`SymptomsContext`, `MedicationsContext`, `AppointmentsContext`) swap their `useLocalStorage` backing for `useEffect`-driven fetches through the API layer, only running once `AuthContext` reports the user is authenticated. A new `NotificationContext` renders one global MUI Snackbar, fed by both the domain contexts' catch blocks and the axios interceptor (via a registered callback) for session-expiry messages.

**Tech Stack:** React 19, MUI 9, react-router-dom 7, axios 1.18 (all already installed — no new dependencies).

## Global Constraints

- API base URL: `http://localhost:4000/api` (default), overridable via `VITE_API_URL` in frontend-root `.env`.
- Token storage: `localStorage`, keys `pulso.token` / `pulso.user` (defined once in `src/api/client.js`, imported everywhere else — never re-declared).
- Backend error envelope: `{ error: { message, code, details } }` (confirmed in `server/src/middlewares/error.middleware.js`). The axios layer normalizes every rejection to a plain `{ message, code, details }` object (no `error` wrapper) — every `.catch` in the frontend reads `err.message` directly.
- Medications data shape changes from `{dose, time, takenDates: []}` to `{dosage, frequency, takenToday}` — adapting frontend to backend, per approved spec decision 1.
- Symptoms and Appointments data shapes are unchanged (already match the backend).
- No seed/mock data anywhere — new/empty accounts see empty states.
- No new test framework — verification per task is `npm run lint` (oxlint) + `npm run build` (vite build) as compile-time gates, with full manual browser walkthroughs at the two integration checkpoints (Task 7 and Task 11), matching the spec's stated manual-verification approach.
- Out of scope (do not touch): `src/pages/Sintomas.jsx`, `src/pages/Medicamentos.jsx`, `src/pages/Citas.jsx` stay as "Próximamente" stubs.

Reference spec: `docs/superpowers/specs/2026-07-21-frontend-api-integration-design.md`

---

### Task 1: Environment & Axios Client

**Files:**
- Modify: `.env` (currently exists but empty, at project root)
- Create: `src/api/client.js`

**Interfaces:**
- Produces: default export `client` (configured axios instance), named exports `TOKEN_KEY` (string `'pulso.token'`), `USER_KEY` (string `'pulso.user'`), `registerErrorNotifier(fn)` (registers a callback invoked with a message string on session expiry).

- [ ] **Step 1: Populate the frontend `.env`**

```
VITE_API_URL=http://localhost:4000/api
```

(This file is already listed in `.gitignore` under `.env` / `.env.*`, so it stays local-only — matches how `server/.env` is handled.)

- [ ] **Step 2: Create the axios client with interceptors**

`src/api/client.js`:
```js
import axios from 'axios';

export const TOKEN_KEY = 'pulso.token';
export const USER_KEY = 'pulso.user';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const client = axios.create({ baseURL });

let notifySessionExpired = () => {};

export function registerErrorNotifier(fn) {
  notifySessionExpired = fn;
}

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      return Promise.reject({
        message: 'No se pudo conectar con el servidor. Verifica tu conexión.',
        code: 'NETWORK_ERROR',
        details: [],
      });
    }

    const { status, data } = error.response;

    if (status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      notifySessionExpired('Tu sesión expiró. Inicia sesión de nuevo.');
    }

    const apiError = data?.error || {};
    return Promise.reject({
      message: apiError.message || 'Ocurrió un error inesperado.',
      code: apiError.code || 'UNKNOWN_ERROR',
      details: apiError.details || [],
    });
  }
);

export default client;
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run lint`
Expected: no errors reported for `src/api/client.js`.

Run: `npm run build`
Expected: `✓ built in ...` with no errors.

- [ ] **Step 4: Commit**

```bash
git add .env src/api/client.js
git commit -m "feat: add axios client with auth interceptor and error normalization"
```

---

### Task 2: API Resource Modules

**Files:**
- Create: `src/api/auth.js`
- Create: `src/api/symptoms.js`
- Create: `src/api/medications.js`
- Create: `src/api/appointments.js`

**Interfaces:**
- Consumes: default export `client` from `src/api/client.js` (Task 1).
- Produces:
  - `auth.js`: `register({name, email, password})`, `login({email, password})`, `getMe()` — all return the raw response body (`{user, token}` for register/login, the public user object for getMe, per `server/src/controllers/auth.controller.js`).
  - `symptoms.js`: `getSymptoms(params)` → `{data, pagination}`, `createSymptom(payload)` → created symptom object.
  - `medications.js`: `getMedications(params)` → `{data, pagination}`, `getMedicationLogs(id, params)` → `{data}`, `upsertMedicationLog(id, payload)` → the log object `{id, medicationId, date, taken, ...}`.
  - `appointments.js`: `getAppointments(params)` → `{data, pagination}`.

- [ ] **Step 1: Auth API module**

`src/api/auth.js`:
```js
import client from './client';

export async function register({ name, email, password }) {
  const { data } = await client.post('/auth/register', { name, email, password });
  return data;
}

export async function login({ email, password }) {
  const { data } = await client.post('/auth/login', { email, password });
  return data;
}

export async function getMe() {
  const { data } = await client.get('/auth/me');
  return data;
}
```

- [ ] **Step 2: Symptoms API module**

`src/api/symptoms.js`:
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
```

- [ ] **Step 3: Medications API module**

`src/api/medications.js`:
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
```

- [ ] **Step 4: Appointments API module**

`src/api/appointments.js`:
```js
import client from './client';

export async function getAppointments(params = {}) {
  const { data } = await client.get('/appointments', { params });
  return data;
}
```

- [ ] **Step 5: Verify (with backend running) using the browser console**

Start the backend: `cd server && npm run dev` (leave running).
Start the frontend: `npm run dev` (leave running), open `http://localhost:5173` in a browser, open devtools console.

Since these are plain ES modules (not exposed on `window`), verify via a temporary inline check instead of guessing: open the Network tab, then in the console run:

```js
fetch('http://localhost:4000/api/health').then((r) => r.json()).then(console.log)
```

Expected: `{status: "ok"}` — confirms the backend is reachable at the configured base URL before wiring any UI to it.

- [ ] **Step 6: Verify build**

Run: `npm run lint`
Expected: no errors.

Run: `npm run build`
Expected: `✓ built in ...`.

- [ ] **Step 7: Commit**

```bash
git add src/api/auth.js src/api/symptoms.js src/api/medications.js src/api/appointments.js
git commit -m "feat: add API resource modules for auth, symptoms, medications, appointments"
```

---

### Task 3: NotificationContext

**Files:**
- Create: `src/contexts/NotificationContext.jsx`

**Interfaces:**
- Consumes: `registerErrorNotifier` from `src/api/client.js` (Task 1).
- Produces: `NotificationProvider` component, `useNotification()` hook returning `{ notifyError(message), notifySuccess(message) }`.

- [ ] **Step 1: Create the context**

`src/contexts/NotificationContext.jsx`:
```jsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { registerErrorNotifier } from '../api/client';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'error' });

  const notify = useCallback((message, severity) => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const notifyError = useCallback((message) => notify(message, 'error'), [notify]);
  const notifySuccess = useCallback((message) => notify(message, 'success'), [notify]);

  useEffect(() => {
    registerErrorNotifier(notifyError);
  }, [notifyError]);

  const handleClose = (_event, reason) => {
    if (reason === 'clickaway') return;
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const value = useMemo(() => ({ notifyError, notifySuccess }), [notifyError, notifySuccess]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={handleClose}>
        <Alert onClose={handleClose} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification debe usarse dentro de NotificationProvider');
  return ctx;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run lint`
Expected: no errors.

Run: `npm run build`
Expected: `✓ built in ...` (the component isn't mounted in `App.jsx` yet, so this only checks it compiles standalone).

- [ ] **Step 3: Commit**

```bash
git add src/contexts/NotificationContext.jsx
git commit -m "feat: add NotificationContext with global Snackbar/Alert"
```

---

### Task 4: AuthContext

**Files:**
- Create: `src/contexts/AuthContext.jsx`

**Interfaces:**
- Consumes: `register`, `login`, `getMe` from `src/api/auth.js` (Task 2); `TOKEN_KEY`, `USER_KEY` from `src/api/client.js` (Task 1).
- Produces: `AuthProvider` component, `useAuth()` hook returning `{ user, token, isAuthenticated, loading, login(email, password), register(name, email, password), logout() }`.

- [ ] **Step 1: Create the context**

`src/contexts/AuthContext.jsx`:
```jsx
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { register as apiRegister, login as apiLogin, getMe } from '../api/auth';
import { TOKEN_KEY, USER_KEY } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      setLoading(false);
      return;
    }

    getMe()
      .then((me) => {
        setUser(me);
        setToken(storedToken);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { user: loggedUser, token: newToken } = await apiLogin({ email, password });
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(loggedUser));
    setUser(loggedUser);
    setToken(newToken);
  };

  const register = async (name, email, password) => {
    const { user: newUser, token: newToken } = await apiRegister({ name, email, password });
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setUser(newUser);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setToken(null);
  };

  const value = useMemo(
    () => ({ user, token, isAuthenticated: Boolean(token && user), loading, login, register, logout }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run lint`
Expected: no errors.

Run: `npm run build`
Expected: `✓ built in ...`.

- [ ] **Step 3: Commit**

```bash
git add src/contexts/AuthContext.jsx
git commit -m "feat: add AuthContext with login, register, logout, and mount-time token validation"
```

---

### Task 5: Login.jsx wiring

**Files:**
- Modify: `src/pages/Login.jsx` (full rewrite)

**Interfaces:**
- Consumes: `useAuth()` from Task 4 (`login`, `isAuthenticated`), `useNotification()` from Task 3 (`notifyError`).

- [ ] **Step 1: Rewrite the Login page**

`src/pages/Login.jsx`:
```jsx
import { useState } from 'react';
import { Navigate, Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Link from '@mui/material/Link';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const { notifyError } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
      const redirectTo = location.state?.from?.pathname || '/';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      notifyError(err.message || 'No se pudo iniciar sesión');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 400 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h1" sx={{ mb: 1 }}>
            Pulso
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Inicia sesión para continuar
          </Typography>

          <Stack spacing={2} component="form" onSubmit={handleSubmit}>
            <TextField
              label="Correo electrónico"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
            />
            <Button type="submit" variant="contained" color="primary" size="large" fullWidth disabled={submitting}>
              {submitting ? 'Entrando...' : 'Entrar'}
            </Button>
            <Typography align="center" color="text.secondary">
              ¿No tienes cuenta?{' '}
              <Link component={RouterLink} to="/registro">
                Regístrate
              </Link>
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run lint`
Expected: no errors.

Run: `npm run build`
Expected: `✓ built in ...`. (Full runtime check happens in Task 7 once `App.jsx` mounts `AuthProvider`/`NotificationProvider`.)

- [ ] **Step 3: Commit**

```bash
git add src/pages/Login.jsx
git commit -m "feat: wire Login page to AuthContext"
```

---

### Task 6: Register.jsx new page

**Files:**
- Create: `src/pages/Register.jsx`

**Interfaces:**
- Consumes: `useAuth()` from Task 4 (`register`, `isAuthenticated`), `useNotification()` from Task 3 (`notifyError`).

- [ ] **Step 1: Create the Register page**

`src/pages/Register.jsx`:
```jsx
import { useState } from 'react';
import { Navigate, Link as RouterLink, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Link from '@mui/material/Link';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

export default function Register() {
  const { register, isAuthenticated } = useAuth();
  const { notifyError } = useNotification();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await register(name, email, password);
      navigate('/', { replace: true });
    } catch (err) {
      notifyError(err.message || 'No se pudo crear la cuenta');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 400 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h1" sx={{ mb: 1 }}>
            Pulso
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Crea tu cuenta
          </Typography>

          <Stack spacing={2} component="form" onSubmit={handleSubmit}>
            <TextField label="Nombre" value={name} onChange={(e) => setName(e.target.value)} fullWidth required />
            <TextField
              label="Correo electrónico"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
            />
            <Button type="submit" variant="contained" color="primary" size="large" fullWidth disabled={submitting}>
              {submitting ? 'Creando cuenta...' : 'Crear cuenta'}
            </Button>
            <Typography align="center" color="text.secondary">
              ¿Ya tienes cuenta?{' '}
              <Link component={RouterLink} to="/login">
                Inicia sesión
              </Link>
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run lint`
Expected: no errors.

Run: `npm run build`
Expected: `✓ built in ...`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Register.jsx
git commit -m "feat: add Register page"
```

---

### Task 7: ProtectedRoute + Navbar logout + App.jsx wiring

This is the first full integration checkpoint — after this task, the app should run end-to-end for auth (register, login, logout, redirect) even though the domain contexts still read from `localStorage` until Tasks 8-10.

**Files:**
- Create: `src/components/ProtectedRoute.jsx`
- Modify: `src/components/Navbar.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `useAuth()` (Task 4), `AuthProvider` (Task 4), `NotificationProvider` (Task 3), `Login`/`Register` (Tasks 5-6).
- Produces: `ProtectedRoute` component taking a `children` prop, rendering `null` while `loading`, redirecting to `/login` with `state={{from: location}}` when unauthenticated, else rendering `children`.

- [ ] **Step 1: Create ProtectedRoute**

`src/components/ProtectedRoute.jsx`:
```jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
```

- [ ] **Step 2: Add a logout button to Navbar**

`src/components/Navbar.jsx` (full file):
```jsx
import { NavLink, useNavigate } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import { useColorMode } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/sintomas', label: 'Síntomas' },
  { to: '/medicamentos', label: 'Medicamentos' },
  { to: '/citas', label: 'Citas' },
];

export default function Navbar() {
  const { mode, toggleColorMode } = useColorMode();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <AppBar position="sticky" color="primary" elevation={0}>
      <Toolbar sx={{ gap: 3 }}>
        <Typography variant="h6" component="div" sx={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600 }}>
          Pulso
        </Typography>

        <Stack direction="row" spacing={1} sx={{ flexGrow: 1 }}>
          {links.map((link) => (
            <Button
              key={link.to}
              component={NavLink}
              to={link.to}
              color="inherit"
              sx={{
                '&.active': {
                  backgroundColor: 'rgba(255,255,255,0.15)',
                },
              }}
            >
              {link.label}
            </Button>
          ))}
        </Stack>

        <IconButton color="inherit" onClick={toggleColorMode} aria-label="Cambiar tema">
          <Typography component="span" sx={{ fontSize: 20 }}>
            {mode === 'dark' ? '☀️' : '🌙'}
          </Typography>
        </IconButton>

        <IconButton color="inherit" onClick={handleLogout} aria-label="Cerrar sesión">
          <Typography component="span" sx={{ fontSize: 20 }}>
            🚪
          </Typography>
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}
```

- [ ] **Step 3: Wire providers and protected routes in App.jsx**

`src/App.jsx` (full file):
```jsx
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import Box from '@mui/material/Box';
import { AppThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { AuthProvider } from './contexts/AuthContext';
import { SymptomsProvider } from './contexts/SymptomsContext';
import { MedicationsProvider } from './contexts/MedicationsContext';
import { AppointmentsProvider } from './contexts/AppointmentsContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
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
      <NotificationProvider>
        <AuthProvider>
          <SymptomsProvider>
            <MedicationsProvider>
              <AppointmentsProvider>
                <BrowserRouter>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/registro" element={<Register />} />
                    <Route
                      element={
                        <ProtectedRoute>
                          <Layout />
                        </ProtectedRoute>
                      }
                    >
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
        </AuthProvider>
      </NotificationProvider>
    </AppThemeProvider>
  );
}

export default App;
```

Note: `ProtectedRoute` wraps `<Layout />` as a layout route's `element`. Nested child routes (`/`, `/sintomas`, etc.) still render through `Layout`'s `<Outlet />` exactly as before — `ProtectedRoute` just gates whether `Layout` (and therefore the `Outlet`) renders at all.

- [ ] **Step 4: Verify build**

Run: `npm run lint`
Expected: no errors.

Run: `npm run build`
Expected: `✓ built in ...`.

- [ ] **Step 5: Manual browser verification (integration checkpoint)**

Ensure the backend is running (`cd server && npm run dev`, listening on port 4000) and start the frontend (`npm run dev`, listening on port 5173).

1. Open `http://localhost:5173/` in a browser with devtools console open.
   Expected: redirected to `http://localhost:5173/login` (no session yet).
2. Click "Regístrate", fill in name/email/password with a fresh email, submit.
   Expected: redirected to `/`, Navbar visible, no console errors. (The Dashboard itself may show empty/broken medication data until Task 9 — that's expected at this checkpoint.)
3. Click the logout icon (🚪) in the Navbar.
   Expected: redirected to `/login`.
4. Log back in with the same credentials on `/login`.
   Expected: redirected to `/` again.
5. Manually navigate to `http://localhost:5173/sintomas` while logged out (use the logout button first).
   Expected: redirected to `/login` (not shown while logged out).
6. Check the browser console throughout.
   Expected: no uncaught errors (401s in the Network tab before login are expected/handled, not uncaught).

- [ ] **Step 6: Commit**

```bash
git add src/components/ProtectedRoute.jsx src/components/Navbar.jsx src/App.jsx
git commit -m "feat: add ProtectedRoute, Navbar logout, and wire auth providers into App"
```

---

### Task 8: SymptomsContext refactor + SymptomFormModal update

**Files:**
- Modify: `src/contexts/SymptomsContext.jsx` (full rewrite)
- Modify: `src/components/symptoms/SymptomFormModal.jsx`

**Interfaces:**
- Consumes: `useAuth()` (Task 4) for `isAuthenticated`; `useNotification()` (Task 3) for `notifyError`; `getSymptoms`, `createSymptom` from `src/api/symptoms.js` (Task 2).
- Produces: `useSymptoms()` returns `{ symptoms, addSymptom(entry), last7Days, loading }`. `addSymptom` is now `async` and returns the created symptom; it rejects on failure (caller decides how to surface the error) — unlike `MedicationsContext.toggleTaken` in Task 9, which has no calling-component-owned loading state and so handles its own `notifyError`.

- [ ] **Step 1: Rewrite SymptomsContext**

`src/contexts/SymptomsContext.jsx`:
```jsx
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getSymptoms, createSymptom } from '../api/symptoms';
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

    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    setLoading(true);
    getSymptoms({ from, to, limit: 100 })
      .then((res) => setSymptoms(res.data))
      .catch((err) => notifyError(err.message || 'No se pudieron cargar los síntomas'))
      .finally(() => setLoading(false));
  }, [isAuthenticated, notifyError]);

  const addSymptom = async (entry) => {
    const created = await createSymptom(entry);
    setSymptoms((prev) => [created, ...prev]);
    return created;
  };

  const last7Days = useMemo(() => computeLast7Days(symptoms), [symptoms]);

  const value = useMemo(
    () => ({ symptoms, addSymptom, last7Days, loading }),
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

- [ ] **Step 2: Update SymptomFormModal to handle the now-async addSymptom**

`src/components/symptoms/SymptomFormModal.jsx` (full file):
```jsx
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
import { useNotification } from '../../contexts/NotificationContext';

function nowForInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const marks = [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) }));
const intensityColors = { 1: '#3B8C5A', 2: '#8FB03E', 3: '#C6821F', 4: '#D85A30', 5: '#C0392B' };

export default function SymptomFormModal({ open, onClose }) {
  const { addSymptom } = useSymptoms();
  const { notifyError } = useNotification();
  const [datetime, setDatetime] = useState(nowForInput);
  const [description, setDescription] = useState('');
  const [intensity, setIntensity] = useState(3);
  const [saving, setSaving] = useState(false);

  const isValid = description.trim().length > 0 && datetime.length > 0;

  const handleClose = () => {
    setDatetime(nowForInput());
    setDescription('');
    setIntensity(3);
    onClose();
  };

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      await addSymptom({
        datetime: new Date(datetime).toISOString(),
        description: description.trim(),
        intensity,
      });
      handleClose();
    } catch (err) {
      notifyError(err.message || 'No se pudo guardar el síntoma');
    } finally {
      setSaving(false);
    }
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
        <Button onClick={handleSave} variant="contained" disabled={!isValid || saving}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run lint`
Expected: no errors.

Run: `npm run build`
Expected: `✓ built in ...`.

- [ ] **Step 4: Manual browser verification**

With both dev servers running and logged in (from Task 7):
1. Go to `/` (Dashboard).
   Expected: no console errors; "Patrón de síntomas (7 días)" chart renders (empty/flat if the account has no symptoms yet).
2. Click the add-record FAB, fill in the symptom form, click "Guardar".
   Expected: button shows "Guardando..." briefly, dialog closes, the new symptom is reflected in the "Síntomas (7 días)" metric card and the chart without a page reload.
3. Reload the page.
   Expected: the symptom just added is still there (confirms it was persisted via `POST /api/symptoms`, not just local state).

- [ ] **Step 5: Commit**

```bash
git add src/contexts/SymptomsContext.jsx src/components/symptoms/SymptomFormModal.jsx
git commit -m "feat: load and create symptoms via the API instead of localStorage"
```

---

### Task 9: MedicationsContext refactor + MedicationsList update

**Files:**
- Modify: `src/contexts/MedicationsContext.jsx` (full rewrite)
- Modify: `src/components/dashboard/MedicationsList.jsx`

**Interfaces:**
- Consumes: `useAuth()` (Task 4); `useNotification()` (Task 3); `getMedications`, `getMedicationLogs`, `upsertMedicationLog` from `src/api/medications.js` (Task 2).
- Produces: `useMedications()` returns `{ medications, toggleTaken(id), todayAdherence, loading }`, where each medication is shaped `{id, name, dosage, frequency, takenToday, ...}` — `dose`/`time`/`takenDates` no longer exist anywhere in this context or its consumers.

- [ ] **Step 1: Rewrite MedicationsContext**

`src/contexts/MedicationsContext.jsx`:
```jsx
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getMedications, getMedicationLogs, upsertMedicationLog } from '../api/medications';
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

    const today = todayKey();
    setLoading(true);
    getMedications()
      .then(async (res) => {
        const withLogs = await Promise.all(
          res.data.map(async (med) => {
            const logsRes = await getMedicationLogs(med.id, { from: today, to: today });
            const takenToday = logsRes.data.some((log) => log.date.slice(0, 10) === today && log.taken);
            return { ...med, takenToday };
          })
        );
        setMedications(withLogs);
      })
      .catch((err) => notifyError(err.message || 'No se pudieron cargar los medicamentos'))
      .finally(() => setLoading(false));
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

  const todayAdherence = useMemo(() => {
    if (medications.length === 0) return null;
    const takenCount = medications.filter((med) => med.takenToday).length;
    return Math.round((takenCount / medications.length) * 100);
  }, [medications]);

  const value = useMemo(
    () => ({ medications, toggleTaken, todayAdherence, loading }),
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

- [ ] **Step 2: Update MedicationsList for the new data shape**

`src/components/dashboard/MedicationsList.jsx` (full file):
```jsx
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import { useMedications } from '../../contexts/MedicationsContext';

export default function MedicationsList() {
  const { medications, toggleTaken } = useMedications();

  if (medications.length === 0) {
    return <Typography color="text.secondary">No hay medicamentos programados para hoy.</Typography>;
  }

  return (
    <List disablePadding>
      {medications.map((med) => (
        <ListItemButton key={med.id} onClick={() => toggleTaken(med.id)} dense disableGutters>
          <ListItemIcon sx={{ minWidth: 40 }}>
            <Checkbox edge="start" checked={med.takenToday} tabIndex={-1} disableRipple />
          </ListItemIcon>
          <ListItemText
            primary={`${med.name} — ${med.dosage}`}
            secondary={med.frequency}
            sx={{ textDecoration: med.takenToday ? 'line-through' : 'none' }}
          />
        </ListItemButton>
      ))}
    </List>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run lint`
Expected: no errors.

Run: `npm run build`
Expected: `✓ built in ...`.

- [ ] **Step 4: Manual browser verification**

With both dev servers running and logged in:
1. If the test account has no medications yet, create one directly against the API to have something to check against (adjust `TOKEN` to a value copied from `localStorage.getItem('pulso.token')` in the browser console):
   ```bash
   curl -X POST http://localhost:4000/api/medications \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <TOKEN>" \
     -d '{"name":"Losartán","dosage":"50mg","frequency":"Cada 24 horas"}'
   ```
   Expected: `201` with the created medication JSON.
2. Reload `/` (Dashboard).
   Expected: "Medicamentos de hoy" card shows the medication with `dosage` and `frequency` displayed, unchecked.
3. Click the medication row to check it off.
   Expected: checkbox becomes checked, text gets a strikethrough, "Adherencia hoy" metric updates, no console errors.
4. Reload the page.
   Expected: the medication is still shown as checked (confirms the log persisted via `POST /api/medications/:id/logs`).
5. Click the row again to uncheck it, reload.
   Expected: unchecked state persists too.

- [ ] **Step 5: Commit**

```bash
git add src/contexts/MedicationsContext.jsx src/components/dashboard/MedicationsList.jsx
git commit -m "feat: load medications and adherence logs via the API, adapting to the backend data shape"
```

---

### Task 10: AppointmentsContext refactor

**Files:**
- Modify: `src/contexts/AppointmentsContext.jsx` (full rewrite)

**Interfaces:**
- Consumes: `useAuth()` (Task 4); `useNotification()` (Task 3); `getAppointments` from `src/api/appointments.js` (Task 2).
- Produces: `useAppointments()` returns `{ appointments, nextAppointment, loading }` — same shape as before, `AppointmentsList.jsx` and `Dashboard.jsx` need no changes.

- [ ] **Step 1: Rewrite AppointmentsContext**

`src/contexts/AppointmentsContext.jsx`:
```jsx
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getAppointments } from '../api/appointments';
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
    getAppointments()
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

  const value = useMemo(
    () => ({ appointments, nextAppointment, loading }),
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

- [ ] **Step 2: Verify build**

Run: `npm run lint`
Expected: no errors.

Run: `npm run build`
Expected: `✓ built in ...`.

- [ ] **Step 3: Manual browser verification**

With both dev servers running and logged in:
1. Create an appointment directly against the API (reuse the token from Task 9's console check):
   ```bash
   curl -X POST http://localhost:4000/api/appointments \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <TOKEN>" \
     -d '{"doctor":"Dra. Elena Ruiz","specialty":"Medicina general","datetime":"2026-08-01T14:00:00.000Z","location":"Clínica Central"}'
   ```
   Expected: `201` with the created appointment JSON.
2. Reload `/` (Dashboard).
   Expected: "Próxima cita" metric card and "Próximas citas" list both show the new appointment, no console errors.

- [ ] **Step 4: Commit**

```bash
git add src/contexts/AppointmentsContext.jsx
git commit -m "feat: load appointments via the API"
```

---

### Task 11: Cleanup — delete useLocalStorage.js + full manual E2E walkthrough

**Files:**
- Delete: `src/hooks/useLocalStorage.js`

- [ ] **Step 1: Confirm nothing still imports it**

Search the codebase for any remaining reference:
```bash
grep -rn "useLocalStorage" src/
```
Expected: no results (all three contexts were refactored off it in Tasks 8-10).

- [ ] **Step 2: Delete the file**

```bash
git rm src/hooks/useLocalStorage.js
```

- [ ] **Step 3: Verify build**

Run: `npm run lint`
Expected: no errors.

Run: `npm run build`
Expected: `✓ built in ...`.

- [ ] **Step 4: Full manual E2E walkthrough (final checkpoint)**

With `server` (`npm run dev`, port 4000) and the frontend (`npm run dev`, port 5173) both running, and browser devtools console open throughout:

1. Clear any existing session: run `localStorage.clear()` in the console, reload.
   Expected: redirected to `/login`.
2. Go to `/registro`, register a brand-new account.
   Expected: redirected to `/`, Dashboard loads with empty states (no symptoms/medications/appointments yet) since this is a fresh account, no console errors.
3. Add a symptom via the FAB + modal.
   Expected: appears immediately in the chart/metric, persists across reload.
4. Create a medication via `curl` (as in Task 9 Step 4), reload, toggle it taken/untaken twice.
   Expected: checkbox state and "Adherencia hoy" update correctly and persist across reloads.
5. Create an appointment via `curl` (as in Task 10 Step 3), reload.
   Expected: shows in "Próxima cita" and the appointments list.
6. Log out via the Navbar button.
   Expected: redirected to `/login`; manually visiting `/`, `/sintomas`, `/medicamentos`, or `/citas` all redirect back to `/login`.
7. Log back in.
   Expected: redirected to `/`, all previously created data still present.
8. Try logging in with a wrong password.
   Expected: global Snackbar shows an error message (e.g. "Email o contraseña incorrectos"), stays on `/login`.
9. In the console, run `localStorage.setItem('pulso.token', 'invalid-token')`, then reload `/`.
   Expected: the mount-time `GET /me` check fails, session is cleared, redirected to `/login` — no crash.
10. Check the Network tab across the whole walkthrough.
    Expected: every authenticated request carries an `Authorization: Bearer ...` header; no unhandled promise rejections in the console at any point.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove unused useLocalStorage hook after API migration"
```

---

## Self-Review

**Spec coverage:**
- Axios base URL config → Task 1.
- Login/Register + JWT storage → Tasks 4-7.
- SymptomsContext → Task 8. MedicationsContext → Task 9. AppointmentsContext → Task 10.
- JWT attached to authenticated calls → Task 1 (request interceptor).
- Error messages in the UI → Task 3 (NotificationContext) + every context's `.catch`/`try` block in Tasks 4, 8, 9, 10 + Login/Register in Tasks 5-6.
- Route protection + redirect-back → Task 7.
- Medications data-shape adaptation → Task 9.
- Seed data removal → Tasks 8-10 rewrites contain no `seed*` functions.
- `useLocalStorage` removal → Task 11.

**Placeholder scan:** no TBD/TODO; every step has complete, runnable code or exact commands with expected output.

**Type/shape consistency:** `med.dosage`/`med.frequency`/`med.takenToday` used consistently across Task 9's context and `MedicationsList.jsx`; `TOKEN_KEY`/`USER_KEY` defined once in `client.js` (Task 1) and imported (never re-declared) in `AuthContext.jsx` (Task 4); `notifyError`/`notifySuccess` naming consistent across Tasks 3-10; `registerErrorNotifier` defined in Task 1, consumed in Task 3.
