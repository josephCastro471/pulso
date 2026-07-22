# Registro de Medicamentos y Saludo Personalizado — Design Spec

**Date:** 2026-07-22
**Status:** Approved by user, ready for implementation planning

## Overview

Pulso ya tiene autenticación, registro de síntomas, y una lista de medicamentos de solo lectura (cargada desde el backend, con logs de "tomado" del día). Esta iteración añade dos mejoras pequeñas y desacopladas al Dashboard:

1. **Registro de medicamentos** — habilitar la creación de medicamentos desde el FAB del Dashboard, conectando con el endpoint ya existente `POST /api/medications`.
2. **Saludo personalizado** — reemplazar el saludo genérico "Hola 👋" por "Hola, [nombre] 👋" usando el nombre del usuario autenticado.

Ambas mejoras son puramente de frontend. El backend ya expone todo lo necesario: `POST /medications` (valida `name`, `dosage`, `frequency`, todos requeridos) y el endpoint `GET /me` / login / register ya devuelven `user.name`. No se requiere ningún cambio de backend.

## Arquitectura

Ambas features siguen patrones ya establecidos y probados en el código existente:

- El registro de medicamentos sigue exactamente el patrón de `SymptomFormModal` + `SymptomsContext.addSymptom`: un modal MUI controlado, un método async en el contexto que llama a la API y actualiza el estado local, y manejo de errores vía `NotificationContext`.
- El saludo personalizado es un cambio de una sola línea en `Dashboard.jsx`, leyendo `user` desde `useAuth()`.

No hay decisiones arquitectónicas nuevas que tomar — es composición directa de piezas existentes.

## Componentes

### 1. `src/api/medications.js` — nueva función `createMedication`

Se añade una función siguiendo el mismo patrón que las funciones existentes del archivo (`getMedications`, `getMedicationLogs`, `upsertMedicationLog`):

```js
export async function createMedication(payload) {
  const { data } = await client.post('/medications', payload);
  return data;
}
```

`payload` será `{ name, dosage, frequency }`. La respuesta del backend es el objeto medicamento creado (incluyendo `id`, `userId`, timestamps).

### 2. `src/contexts/MedicationsContext.jsx` — nuevo método `addMedication`

Se añade un método `addMedication(data)` que:
- Llama a `createMedication(data)`.
- En éxito, agrega el medicamento devuelto al estado `medications`, sintetizando `takenToday: false` en el cliente (ya que el medicamento recién creado no tiene logs todavía).
- Relanza (`throw`) cualquier error para que el modal lo capture y muestre la notificación — igual que `addSymptom` en `SymptomsContext`. No se captura el error dentro del contexto.
- Se expone en el valor del contexto (`value` del `useMemo`), junto a los campos existentes.

No se modifica el `useEffect` de carga inicial ni `toggleTaken`, que ya funcionan correctamente.

### 3. `src/components/medications/MedicationFormModal.jsx` — nuevo componente

Nuevo directorio `src/components/medications/` (mirroring `src/components/symptoms/`). Estructura idéntica a `SymptomFormModal`:

- Props: `{ open, onClose }`.
- Estado local: `name`, `dosage`, `frequency` (los tres `string`, inicializados a `''`), y `saving` (`boolean`).
- `isValid`: los tres campos, tras `.trim()`, tienen longitud > 0 (coincide con la validación Zod del backend: los tres son requeridos).
- `handleClose`: resetea los tres campos a `''` y llama a `onClose()`.
- `handleSave`: si `!isValid`, no hace nada. Si es válido, pone `saving = true`, llama a `addMedication({ name: name.trim(), dosage: dosage.trim(), frequency: frequency.trim() })` dentro de un `try/catch/finally`. En éxito llama a `handleClose()`. En error, llama a `notifyError(err.message || 'No se pudo guardar el medicamento')`. En `finally`, `saving = false`.
- UI: `Dialog`/`DialogTitle` ("Registrar medicamento")/`DialogContent` con tres `TextField` (Nombre, Dosis, Frecuencia — todos `fullWidth`, `required`)/`DialogActions` con botones Cancelar y Guardar (`disabled={!isValid || saving}`, texto "Guardando..." mientras se guarda) — mismo look & feel que `SymptomFormModal`.

### 4. `src/components/dashboard/AddRecordFab.jsx` — habilitar acción "Medicamento"

- Cambiar `{ key: 'medicamento', icon: '💊', name: 'Medicamento', disabled: true }` → `disabled: false`.
- Añadir prop `onAddMedication` a la firma del componente.
- En `handleActionClick`, añadir: `if (key === 'medicamento') onAddMedication();`.
- La acción `cita` permanece deshabilitada (fuera de alcance de este trabajo).

### 5. `src/pages/Dashboard.jsx` — wiring del modal y saludo personalizado

- Nuevo estado: `const [medicationModalOpen, setMedicationModalOpen] = useState(false);`.
- Pasar `onAddMedication={() => setMedicationModalOpen(true)}` a `<AddRecordFab>`.
- Renderizar `<MedicationFormModal open={medicationModalOpen} onClose={() => setMedicationModalOpen(false)} />` junto al `SymptomFormModal` existente.
- Importar `useAuth` desde `../contexts/AuthContext` y leer `const { user } = useAuth();`.
- Cambiar el `<Typography variant="h1">Hola 👋</Typography>` por `` `Hola, ${user.name} 👋` ``. Dado que `Dashboard` ya está detrás de `ProtectedRoute` (confirmado en trabajo previo), `user` siempre estará poblado cuando este componente se renderice — no se necesita guarda adicional de "no autenticado" aquí.

### Componentes sin cambios

- `MedicationsList.jsx` — ya renderiza `name`/`dosage`/`frequency` y el checkbox "tomado" vía `toggleTaken`; funciona sin cambios en cuanto `addMedication` agregue el nuevo medicamento al arreglo `medications`.

## Flujo de datos

1. Usuario hace clic en el FAB → "Medicamento" → `AddRecordFab` llama a `onAddMedication()` → `Dashboard` abre `MedicationFormModal`.
2. Usuario completa nombre/dosis/frecuencia y hace clic en "Guardar" → `MedicationFormModal.handleSave` llama a `addMedication` del contexto.
3. `MedicationsContext.addMedication` llama a `createMedication` (POST `/medications`) → en éxito, agrega `{...creado, takenToday: false}` al estado `medications`.
4. El nuevo medicamento aparece inmediatamente en "Medicamentos de hoy" (`MedicationsList`, que lee del mismo contexto) con el checkbox sin marcar.
5. Usuario hace clic en el checkbox → `toggleTaken(id)` (ya implementado) llama a `POST /medications/:id/logs` y actualiza `takenToday`.

## Manejo de errores

- Error al crear medicamento (red, validación backend, etc.): el modal permanece abierto, `notifyError` muestra el mensaje vía el snackbar global (`NotificationContext`), `saving` vuelve a `false` para permitir reintentar.
- No se introduce manejo de errores nuevo para el saludo — `user.name` siempre estará presente dado que la ruta está protegida.

## Testing / Verificación

No existe test runner de frontend en este proyecto (solo `oxlint`). La verificación sigue el patrón manual ya usado en iteraciones anteriores:

1. Levantar backend (`npm run dev` en `server/`) y frontend (`npm run dev` en la raíz).
2. Iniciar sesión en la app.
3. Abrir el FAB → confirmar que "Medicamento" ya no está deshabilitado.
4. Crear un medicamento con los tres campos → confirmar que aparece en "Medicamentos de hoy" sin recargar.
5. Marcar el checkbox "tomado" → confirmar que se tacha y persiste tras recargar la página.
6. Confirmar que el saludo del Dashboard muestra "Hola, [nombre real del usuario] 👋".
7. Ejecutar `oxlint` para confirmar que no hay nuevas advertencias/errores de lint.

## Fuera de alcance

- La acción "Cita" del FAB permanece deshabilitada.
- No se modifica el backend (ya cumple los requisitos exactos).
- No se sube nada a GitHub — todo el trabajo (incluyendo commits locales) permanece en el repositorio local.
