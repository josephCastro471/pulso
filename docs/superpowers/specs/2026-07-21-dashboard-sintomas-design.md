# Diseño: Dashboard funcional + registro de síntomas

Fecha: 2026-07-21

## Objetivo

Convertir el Dashboard placeholder en una vista funcional con datos reales
(persistidos localmente), y permitir al usuario registrar nuevos síntomas
desde un modal accesible por un botón flotante ("+").

No hay backend todavía. Los datos viven en `localStorage`, sembrados con
datos mock la primera vez que se abre la app.

## Modelo de datos

Cada dominio se guarda bajo su propia clave en `localStorage`:

```js
// pulso.symptoms
{ id: string, datetime: string /* ISO */, description: string, intensity: 1|2|3|4|5 }

// pulso.medications
{ id: string, name: string, dose: string, time: string /* "HH:mm" */, takenDates: string[] /* ["2026-07-20", ...] */ }

// pulso.appointments
{ id: string, doctor: string, specialty: string, datetime: string /* ISO */, location: string }
```

Si una clave no existe en `localStorage` (primera carga), se siembra con
datos mock:
- 5-6 síntomas repartidos en los últimos 7 días, intensidades variadas.
- 3 medicamentos con horarios de hoy.
- 2 citas: una pasada, una futura.

Si el JSON guardado está corrupto o no parsea, se trata como si no
existiera y se regenera el seed mock (no debe romper la app).

## Arquitectura de estado

Context por dominio (mismo patrón que `ThemeContext.jsx` existente),
respaldado por un hook genérico de localStorage:

```
src/hooks/useLocalStorage.js
src/contexts/SymptomsContext.jsx      -> useSymptoms()
src/contexts/MedicationsContext.jsx   -> useMedications()
src/contexts/AppointmentsContext.jsx  -> useAppointments()
```

- `useLocalStorage(key, initialValue)`: hook genérico, lee/escribe JSON,
  maneja parse errors regenerando `initialValue`.
- `useSymptoms()`: expone `{ symptoms, addSymptom(entry), last7Days }`.
  `last7Days` es un selector derivado: array de 7 días con
  `{ date, avgIntensity }` (día sin registros → `avgIntensity: null`).
- `useMedications()`: expone `{ medications, toggleTaken(id, date), todayAdherence }`.
  `todayAdherence` = % de medicamentos de hoy con la fecha de hoy en
  `takenDates` (0 si no hay medicamentos hoy, mostrar "N/A" en la UI).
- `useAppointments()`: expone `{ appointments, nextAppointment }`.
  `nextAppointment` = la cita futura más próxima por `datetime`, o `null`.

Los tres providers se agregan en `App.jsx`, envolviendo las rutas junto al
`AppThemeProvider` existente.

## Componentes

```
src/components/dashboard/
  MetricCard.jsx        # tarjeta reutilizable: label, valor, color opcional
  SymptomsChart.jsx     # LineChart (recharts) de intensidad promedio, 7 días
  MedicationsList.jsx   # checklist interactivo de medicamentos de hoy
  AppointmentsList.jsx  # lista de próximas citas, ordenadas por fecha
  AddRecordFab.jsx      # SpeedDial ("+"): acción "Síntoma" activa,
                         # "Medicamento"/"Cita" deshabilitadas con tooltip
                         # "Próximamente"
src/components/symptoms/
  SymptomFormModal.jsx  # Dialog de registro de síntoma
```

### Dashboard.jsx (composición)

1. Header: saludo + fecha actual (ya existente, se mantiene).
2. Fila de 3 `MetricCard`:
   - "Síntomas (7 días)": cantidad de registros en los últimos 7 días.
   - "Adherencia hoy": `todayAdherence` formateado como %.
   - "Próxima cita": `nextAppointment` formateada (fecha corta + hora), o
     "Sin citas próximas".
3. `SymptomsChart`: LineChart de recharts, eje X = últimos 7 días
   (etiquetas cortas: "lun", "mar"...), eje Y = intensidad promedio. Si
   `last7Days` no tiene ningún día con datos, mostrar mensaje "Aún no hay
   registros" en vez del chart.
4. Dos columnas secundarias: `MedicationsList` y `AppointmentsList`.
   - Sin medicamentos hoy → "No hay medicamentos programados para hoy".
   - Sin citas futuras → "Sin citas próximas".
5. `AddRecordFab` fijo en la esquina inferior derecha.

### SymptomFormModal.jsx

MUI `Dialog`, campos:
- **Fecha y hora**: input `datetime-local`, precargado con la hora actual,
  editable.
- **Descripción**: `TextField` multilinea, requerido.
- **Intensidad**: `Slider` 1-5 con marcas discretas, color de verde (1) a
  rojo (5), valor por defecto 3.

Validación: botón "Guardar" deshabilitado hasta que la descripción no esté
vacía y la fecha/hora sea válida. Al guardar: `addSymptom({...})`, cierre
del modal, el Dashboard se actualiza solo (vía Context, sin refetch
manual).

## Manejo de errores / casos borde

- `localStorage` corrupto o inaccesible (ej. modo privado) → se trata como
  vacío, se regenera el seed mock, no debe lanzar excepción no capturada.
- Sin medicamentos / sin citas / sin síntomas recientes → mensajes de
  estado vacío descritos arriba, nunca un componente roto o `NaN` visible.
- No hay validación de red ni estados de carga (no hay backend aún).

## Testing

Sin infraestructura de testing automatizado en este proyecto todavía. Se
verifica manualmente: dev server + navegación real, confirmando que:
- El Dashboard carga con datos mock la primera vez.
- Agregar un síntoma actualiza el chart y la métrica sin recargar la
  página.
- Marcar un medicamento como tomado actualiza la métrica de adherencia.
- Los tres casos de "sin datos" muestran los mensajes de estado vacío
  correctos.
- Cero errores en consola del navegador en las rutas afectadas.

## Fuera de alcance (explícitamente)

- Persistencia en backend/API real.
- Edición o borrado de síntomas ya registrados.
- Acciones "Medicamento" y "Cita" del FAB (quedan como placeholders
  deshabilitados).
- Tests automatizados (Vitest queda para una iteración futura si el
  proyecto lo requiere).
