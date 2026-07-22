# Registro de Citas — Design Spec

**Date:** 2026-07-22
**Status:** Approved by user, ready for implementation planning

## Overview

Pulso ya tiene autenticación, registro de síntomas, y registro de medicamentos (implementado en esta misma rama). El Dashboard ya carga y muestra las citas existentes (`AppointmentsContext`, `AppointmentsList`, métrica "Próxima cita"), pero no permite crear citas nuevas: la acción "Cita" del FAB está deshabilitada y no existe ningún camino de escritura hacia `POST /api/appointments`.

Esta iteración añade el registro de citas desde el Dashboard, siguiendo exactamente el mismo patrón ya usado y aprobado para el registro de medicamentos:

1. Habilitar la acción "Cita" en el FAB del Dashboard.
2. Nuevo modal `AppointmentFormModal` con los campos Doctor, Especialidad, Fecha y hora, y Ubicación.
3. Conectar el modal con `POST /api/appointments` mediante un nuevo método `addAppointment` en `AppointmentsContext`.
4. Al guardar, la cita aparece de inmediato en "Próximas citas" y actualiza la métrica "Próxima cita" — sin wiring adicional, porque ambos ya se derivan reactivamente (`useMemo`) del array `appointments` del contexto.

Es puramente un cambio de frontend. El backend ya expone `POST /appointments` con la validación y el contrato de respuesta exactos que este trabajo necesita. No se requiere ningún cambio de backend.

### Decisión resuelta: campo Ubicación

La solicitud original pedía que Ubicación fuera opcional. Sin embargo, `server/src/schemas/appointment.schema.js` define `location` como requerido (`z.string().trim().min(1, 'La ubicación es requerida')`), sin `.optional()`. Se presentó este conflicto al usuario, quien decidió: **Ubicación será un campo requerido en el frontend**, igual que Doctor, Especialidad y Fecha y hora — sin relajar el backend ni enviar valores por defecto. Esta decisión es vinculante para el resto de este documento.

## Arquitectura

Se reutiliza exactamente el patrón ya establecido y probado por el registro de medicamentos (`MedicationFormModal` + `MedicationsContext.addMedication`):

- Un modal MUI controlado (`Dialog`/`DialogTitle`/`DialogContent`/`DialogActions`) con estado local de formulario.
- Un método async en el contexto correspondiente (`AppointmentsContext.addAppointment`) que llama a la API y actualiza el estado local en éxito, y relanza el error en fallo para que el modal lo capture.
- Manejo de errores vía el snackbar global (`NotificationContext.notifyError`).
- La métrica "Próxima cita" y la lista "Próximas citas" no requieren cambios: ambas ya leen `appointments`/`nextAppointment` desde `AppointmentsContext`, y `nextAppointment` ya es un `useMemo` derivado del array `appointments`.

No hay decisiones arquitectónicas nuevas que tomar — es composición directa de piezas existentes.

## Componentes

### 1. `src/api/appointments.js` — nueva función `createAppointment`

Se añade siguiendo el mismo patrón que la función existente `getAppointments`:

```js
export async function createAppointment(payload) {
  const { data } = await client.post('/appointments', payload);
  return data;
}
```

`payload` será `{ doctor, specialty, datetime, location }`, con `datetime` como string ISO 8601. La respuesta del backend es el objeto cita creado directamente (incluyendo `id`, `userId`, timestamps) — confirmado leyendo `appointments.controller.js`, mismo contrato de respuesta que `POST /medications`.

### 2. `src/contexts/AppointmentsContext.jsx` — nuevo método `addAppointment`

Se añade un método `addAppointment(data)` que:
- Llama a `createAppointment(data)`.
- En éxito, agrega la cita devuelta al estado `appointments` mediante `setAppointments((prev) => [...prev, created])`.
- Relanza (`throw`) cualquier error para que el modal lo capture y muestre la notificación — igual que `addMedication` en `MedicationsContext`. No se captura el error dentro del contexto.
- Se expone en el valor del contexto (`value` del `useMemo`), junto a los campos existentes (`appointments`, `nextAppointment`, `loading`).

No se modifica el `useEffect` de carga inicial ni el cálculo de `nextAppointment`, que ya funcionan correctamente y recalculan automáticamente cuando `appointments` cambia.

### 3. `src/components/appointments/AppointmentFormModal.jsx` — nuevo componente

Nuevo directorio `src/components/appointments/` (mirroring `src/components/medications/` y `src/components/symptoms/`). Estructura idéntica a `MedicationFormModal`:

- Props: `{ open, onClose }`.
- Estado local: `doctor`, `specialty`, `datetime`, `location` (todos `string`, inicializados a `''`), y `saving` (`boolean`).
- `datetime` se inicializa igual que en `SymptomFormModal`: una función `nowForInput()` que devuelve la fecha/hora actual en el formato que espera un `<input type="datetime-local">` (`YYYY-MM-DDTHH:mm`), para que el campo no aparezca vacío al abrir el modal.
- `isValid`: los cuatro campos, tras `.trim()` (excepto `datetime`, que no necesita trim porque es un valor de input controlado), tienen longitud > 0. Esto coincide con la validación Zod del backend: los cuatro son requeridos.
- `handleClose`: resetea `doctor`, `specialty`, `location` a `''`, resetea `datetime` a `nowForInput()`, y llama a `onClose()`.
- `handleSave`: si `!isValid`, no hace nada. Si es válido, pone `saving = true`, llama a `addAppointment({ doctor: doctor.trim(), specialty: specialty.trim(), datetime: new Date(datetime).toISOString(), location: location.trim() })` dentro de un `try/catch/finally`. En éxito llama a `handleClose()`. En error, llama a `notifyError(err.message || 'No se pudo guardar la cita')`. En `finally`, `saving = false`.
- UI: `Dialog`/`DialogTitle` ("Registrar cita")/`DialogContent` con cuatro `TextField` (Doctor, Especialidad, Fecha y hora — `type="datetime-local"`, `InputLabelProps={{ shrink: true }}` —, Ubicación — todos `fullWidth`, `required`)/`DialogActions` con botones Cancelar y Guardar (`disabled={!isValid || saving}`, texto "Guardando..." mientras se guarda) — mismo look & feel que `MedicationFormModal` y `SymptomFormModal`.

### 4. `src/components/dashboard/AddRecordFab.jsx` — habilitar acción "Cita"

- Cambiar `{ key: 'cita', icon: '📅', name: 'Cita', disabled: true }` → `disabled: false`.
- Añadir prop `onAddAppointment` a la firma del componente.
- En `handleActionClick`, añadir: `if (key === 'cita') onAddAppointment();`.
- Ninguna otra acción del FAB cambia.

### 5. `src/pages/Dashboard.jsx` — wiring del modal

- Nuevo estado: `const [appointmentModalOpen, setAppointmentModalOpen] = useState(false);`.
- Pasar `onAddAppointment={() => setAppointmentModalOpen(true)}` a `<AddRecordFab>`, junto a `onAddSymptom` y `onAddMedication` ya existentes.
- Renderizar `<AppointmentFormModal open={appointmentModalOpen} onClose={() => setAppointmentModalOpen(false)} />` junto a `SymptomFormModal` y `MedicationFormModal` existentes.
- `useAppointments()` ya está importado y en uso (para `nextAppointment`); no requiere cambios adicionales.

### Componentes sin cambios

- `AppointmentsList.jsx` — ya renderiza `doctor`/`specialty`/`datetime`/`location` y maneja el estado vacío ("Sin citas próximas."); funciona sin cambios en cuanto `addAppointment` agregue la nueva cita al arreglo `appointments`.
- La métrica "Próxima cita" en `Dashboard.jsx` (`formatNextAppointment(nextAppointment)`) — ya funciona sin cambios porque `nextAppointment` se recalcula automáticamente vía `useMemo` cuando `appointments` cambia.
- Backend (`appointment.schema.js`, `appointments.controller.js`) — ya cumple los requisitos exactos, no se modifica.

## Flujo de datos

1. Usuario hace clic en el FAB → "Cita" → `AddRecordFab` llama a `onAddAppointment()` → `Dashboard` abre `AppointmentFormModal`.
2. Usuario completa doctor/especialidad/fecha y hora/ubicación y hace clic en "Guardar" → `AppointmentFormModal.handleSave` llama a `addAppointment` del contexto con `datetime` convertido a ISO 8601.
3. `AppointmentsContext.addAppointment` llama a `createAppointment` (POST `/appointments`) → en éxito, agrega la cita creada al estado `appointments`.
4. `nextAppointment` (useMemo) se recalcula automáticamente; si la nueva cita es la más próxima en el futuro, la métrica "Próxima cita" del Dashboard se actualiza sin recargar la página.
5. La nueva cita aparece inmediatamente en "Próximas citas" (`AppointmentsList`, que lee del mismo contexto), ordenada cronológicamente junto a las demás citas futuras.

## Manejo de errores

- Error al crear la cita (red, validación backend, etc.): el modal permanece abierto, `notifyError` muestra el mensaje vía el snackbar global (`NotificationContext`), `saving` vuelve a `false` para permitir reintentar.
- Validación de formato: el input `datetime-local` del navegador ya restringe la entrada a un formato válido; `new Date(datetime).toISOString()` convierte ese valor al formato ISO 8601 que exige `appointmentBodySchema`.

## Testing / Verificación

No existe test runner de frontend en este proyecto (solo `oxlint`). La verificación sigue el patrón manual ya usado en iteraciones anteriores:

1. Levantar backend (`npm run dev` en `server/`) y frontend (`npm run dev` en la raíz).
2. Iniciar sesión en la app.
3. Abrir el FAB → confirmar que "Cita" ya no está deshabilitada.
4. Crear una cita con los cuatro campos → confirmar que aparece en "Próximas citas" sin recargar, y que la métrica "Próxima cita" se actualiza si corresponde (cita más próxima en el tiempo).
5. Intentar guardar con algún campo vacío → confirmar que el botón "Guardar" permanece deshabilitado.
6. Confirmar que el saludo personalizado y el registro de medicamentos (implementados previamente en esta rama) siguen funcionando sin regresiones.
7. Ejecutar `oxlint` para confirmar que no hay nuevas advertencias/errores de lint.

## Fuera de alcance

- No se modifica el backend (ya cumple los requisitos exactos).
- No se añade edición ni eliminación de citas — solo creación.
- No se sube nada a GitHub — todo el trabajo (incluyendo commits locales) permanece en el repositorio local, en la rama `feature/medications-registration-and-greeting`.
