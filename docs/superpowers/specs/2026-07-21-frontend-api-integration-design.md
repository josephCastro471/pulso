# Frontend ↔ API Integration — Design Spec

**Date:** 2026-07-21
**Status:** Approved by user, ready for implementation plan

## Goal

Replace `localStorage` as the persistence layer in the Pulso frontend (React + MUI) with real calls to the already-implemented backend (`server/`, Node.js + Express + PostgreSQL/Prisma, JWT auth). Add login/registration, protect authenticated routes, and surface API errors in the UI.

## Out of scope

- Building full list/edit/delete UI on the `Sintomas.jsx`, `Medicamentos.jsx`, `Citas.jsx` stub pages. They remain "Próximamente" placeholders. Only the Dashboard's existing interactions (add symptom, toggle medication taken, view next appointment) get wired to the real API.
- Password reset, refresh tokens (matches existing backend scope).
- Optimistic UI / offline support.

## Current state (verified in codebase)

- `axios` already in `package.json`. No `.env` / `VITE_API_URL` yet.
- Backend mounts all routes under `/api` (`server/src/app.js:22`), CORS reads `FRONTEND_URL`.
- `Login.jsx` is a static form with no handlers, no registration page exists.
- No route protection exists — all routes render regardless of auth state.
- Three contexts (`SymptomsContext`, `MedicationsContext`, `AppointmentsContext`) wrap `useLocalStorage` and seed mock data when storage is empty.
- **Data shape mismatches found:**
  - Symptoms: frontend `{datetime, description, intensity}` ↔ backend `symptomBodySchema` — **identical**, no changes needed.
  - Appointments: frontend `{doctor, specialty, datetime, location}` ↔ backend `appointmentBodySchema` — **identical**, no changes needed.
  - Medications: frontend `{name, dose, time, takenDates: []}` ↔ backend `medicationBodySchema` `{name, dosage, frequency}` + separate `medicationLog` resource (`POST/GET /medications/:id/logs`, `{date, taken}`). **Not compatible** — resolved below by adapting the frontend to the backend model (user decision).

## Decisions (from clarifying questions)

1. **Medications model**: adapt frontend to backend. Drop the fixed `time` field; use free-text `frequency` (e.g. "Cada 8 horas"); move the "taken today" checkbox to call the `/logs` endpoint instead of an embedded `takenDates` array.
2. **Token storage**: `localStorage` (persists across tab/browser restarts).
3. **Route protection**: redirect unauthenticated users to `/login`, redirect back to the originally requested route after login.
4. **Error display**: global MUI Snackbar/Alert, not per-form inline messages.
5. **Registration**: build a new `/registro` page (backend already supports `POST /api/auth/register`).
6. **Seed/mock data**: removed entirely. New users see empty states until they create real data.
7. **API call layer**: a dedicated `src/api/` module (axios instance + one file per resource) sits between contexts and axios — not axios calls inline in the contexts.
8. **Page scope**: only wire the contexts to the API for what the Dashboard already uses. `Sintomas.jsx` / `Medicamentos.jsx` / `Citas.jsx` stay as stubs.

## Architecture

### API client layer (new)

- **`src/api/client.js`** — axios instance, `baseURL: import.meta.env.VITE_API_URL` (default `http://localhost:4000/api`).
  - Request interceptor: attaches `Authorization: Bearer <token>` from `localStorage` if present.
  - Response interceptor: on `401`, clears the stored token/user and lets the caller's catch handle redirect (via `AuthContext.logout()` + `ProtectedRoute`); on any error, throws an object shaped `{ message, code, details }` taken from the backend's `error` envelope (falling back to a generic network-error message if the response has no body, e.g. connection refused).
- **`src/api/auth.js`** — `register({name, email, password})`, `login({email, password})`, `getMe()`.
- **`src/api/symptoms.js`** — `getSymptoms(params)`, `createSymptom(data)`.
- **`src/api/medications.js`** — `getMedications(params)`, `getMedicationLogs(id, params)`, `upsertMedicationLog(id, {date, taken})`.
- **`src/api/appointments.js`** — `getAppointments(params)`.

### Environment

- New frontend `.env` (project root, alongside `package.json`, distinct from `server/.env`):
  ```
  VITE_API_URL=http://localhost:4000/api
  ```

### Auth

- **`src/contexts/AuthContext.jsx`** (new) — state: `{ user, token, isAuthenticated, loading }`.
  - On mount: if a token exists in `localStorage`, call `GET /me` to validate it and populate `user`; on failure, clear the token. `loading` is `true` until this check resolves.
  - `login(email, password)` → `POST /auth/login` → store token + user.
  - `register(name, email, password)` → `POST /auth/register` → store token + user.
  - `logout()` → clear token/user from state and `localStorage`.
  - Wraps the whole app, above `SymptomsProvider`/`MedicationsProvider`/`AppointmentsProvider`, in `App.jsx`.
- **`src/pages/Login.jsx`** (edit) — wire the existing form to `login()`; show a loading state on submit; on error call `notifyError`; link to `/registro`.
- **`src/pages/Register.jsx`** (new) — name/email/password form → `register()` → redirect to `/`.
- **`src/components/ProtectedRoute.jsx`** (new) — wraps private routes. While `AuthContext.loading` is true, render nothing (or a minimal spinner). If not authenticated, `<Navigate to="/login" state={{ from: location }} />`. `Login`/`Register` themselves redirect to `/` if already authenticated.
- **`App.jsx`** — `/`, `/sintomas`, `/medicamentos`, `/citas` wrapped in `ProtectedRoute`; `/login`, `/registro` public.

### Error handling

- **`src/contexts/NotificationContext.jsx`** (new) — exposes `notifyError(message)` / `notifySuccess(message)`; renders one `<Snackbar><Alert></Alert></Snackbar>` at the app root. `client.js`'s response interceptor and the domain contexts call `notifyError` on failed requests.

### Domain contexts (refactored)

All three follow the same shape: fetch in a `useEffect` once authenticated, expose `loading`, write methods call the API then merge the response into local state (no optimistic updates).

- **`SymptomsContext`** — no data-shape change.
  - Load: `GET /symptoms?from=<today-6d>&to=<today>&limit=100` on mount → `symptoms`.
  - `addSymptom(entry)` → `POST /symptoms` → append result to state.
  - `last7Days` computed client-side exactly as today.
  - Remove `seedSymptoms()`.
- **`MedicationsContext`** — data-shape change per decision 1.
  - Load: `GET /medications` → then, in parallel (`Promise.all`), `GET /medications/:id/logs?from=<today>&to=<today>` per medication → merge into `medications: [{id, name, dosage, frequency, takenToday}]`.
  - `toggleTaken(id)` → `POST /medications/:id/logs {date: today, taken: !takenToday}` → update that medication in state from the response.
  - `todayAdherence` computed the same way but reading `takenToday` instead of `takenDates.includes(today)`.
  - Remove `seedMedications()`.
- **`AppointmentsContext`** — no data-shape change.
  - Load: `GET /appointments` → `appointments`.
  - `nextAppointment` computed client-side exactly as today.
  - Remove `seedAppointments()`.

### Downstream component changes

- **`MedicationsList.jsx`** — `med.dose` → `med.dosage`; `med.time` → `med.frequency`; `med.takenDates.includes(today)` → `med.takenToday`; `toggleTaken(id, date)` → `toggleTaken(id)`.
- **`SymptomFormModal.jsx`** — `addSymptom` is now async: disable "Guardar" while in flight, surface validation errors via `notifyError`.
- **`src/hooks/useLocalStorage.js`** — deleted (no longer used by any context once the above lands).

## Testing approach

No frontend test runner exists yet in this project (only `oxlint`). Verification for this work is manual: run the Vite dev server and the backend dev server together, and walk through register → login → add symptom → toggle medication → view appointments → logout → confirm protected routes redirect, using the browser (per the project's existing manual-verification pattern used for the backend). No new automated test tooling is introduced as part of this spec.

## File summary

**New:**
- `src/api/client.js`, `src/api/auth.js`, `src/api/symptoms.js`, `src/api/medications.js`, `src/api/appointments.js`
- `src/contexts/AuthContext.jsx`, `src/contexts/NotificationContext.jsx`
- `src/components/ProtectedRoute.jsx`
- `src/pages/Register.jsx`
- `.env` (frontend root)

**Modified:**
- `src/App.jsx` (providers + protected routes)
- `src/pages/Login.jsx`
- `src/contexts/SymptomsContext.jsx`, `src/contexts/MedicationsContext.jsx`, `src/contexts/AppointmentsContext.jsx`
- `src/components/dashboard/MedicationsList.jsx`
- `src/components/symptoms/SymptomFormModal.jsx`

**Deleted:**
- `src/hooks/useLocalStorage.js`
