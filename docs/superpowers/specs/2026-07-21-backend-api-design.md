# Backend API de Pulso — Especificación de Diseño

**Fecha:** 2026-07-21
**Estado:** Aprobado

## Objetivo

Construir una API RESTful en Node.js + Express, respaldada por PostgreSQL, que reemplazará eventualmente el almacenamiento en `localStorage` del frontend de Pulso. Este backend está destinado a producción: debe ser seguro (autenticación robusta, datos aislados por usuario, secretos fuera del código) y escalable (paginación, índices, pool de conexiones).

**Fuera de alcance para este proyecto:** integrar el frontend existente (Contexts de React) para que consuma esta API — queda como una fase posterior con su propio spec/plan. Tampoco se incluyen recuperación de contraseña, verificación de email, ni refresh tokens.

## Contexto del proyecto

El frontend de Pulso (React + MUI + recharts, en `src/` en la raíz del repo) ya está completo y funcional usando Contexts respaldados por `localStorage` (`SymptomsContext`, `MedicationsContext`, `AppointmentsContext`), con datos mock sembrados en el primer uso. Este backend vive en una carpeta nueva `server/`, independiente del código del frontend, y no modifica nada dentro de `src/`.

## Arquitectura y stack tecnológico

- **Runtime/Framework:** Node.js + Express.
- **Base de datos:** PostgreSQL.
- **ORM:** Prisma — schema declarativo (`schema.prisma`), migraciones versionadas (`prisma migrate`), cliente generado type-safe.
- **Entorno de desarrollo de la DB:** Docker Compose con un servicio Postgres, para que el entorno sea reproducible sin depender de una instalación local.
- **Autenticación:** JWT firmado (HS256), solo access token (sin refresh token) — expiración media (7 días). Password hashing con `bcrypt` (12 rounds).
- **Validación:** Zod, como middleware por ruta que valida `req.body`/`req.query` antes de llegar al controller.
- **Testing:** Jest + Supertest, tests de integración por endpoint contra una base de datos de test real (mismo Postgres de Docker Compose, base de datos separada).
- **Seguridad transversal:** `helmet` (headers HTTP), `cors` (restringido al origen del frontend vía variable de entorno `FRONTEND_URL`), `express-rate-limit` en rutas de auth, `morgan` para logging de requests.

## Modelo de datos

5 tablas (la quinta, `medication_logs`, surge de la necesidad de trackear adherencia diaria por separado del catálogo de medicamentos):

### `users`
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID | PK, default `gen_random_uuid()` |
| name | String | requerido |
| email | String | único, requerido |
| password_hash | String | requerido, nunca se expone en respuestas |
| created_at | DateTime | default now() |
| updated_at | DateTime | auto-actualizado |

### `symptoms`
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users.id, indexado |
| datetime | DateTime | fecha/hora del síntoma |
| description | String | requerido |
| intensity | Int | 1-5, constraint de rango |
| created_at | DateTime | default now() |
| updated_at | DateTime | auto-actualizado |

Índice compuesto en `(user_id, datetime)` para acelerar filtros por rango de fechas paginados.

### `medications`
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users.id, indexado |
| name | String | requerido |
| dosage | String | requerido |
| frequency | String | texto libre (ej. "cada 8 horas") |
| created_at | DateTime | default now() |
| updated_at | DateTime | auto-actualizado |

### `medication_logs`
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID | PK |
| medication_id | UUID | FK → medications.id, indexado |
| date | Date | día calendario del registro (sin hora) |
| taken | Boolean | default false |
| created_at | DateTime | default now() |
| updated_at | DateTime | auto-actualizado |

Constraint único en `(medication_id, date)` — un solo registro de adherencia por medicamento por día; marcar/desmarcar es un upsert sobre esa combinación.

### `appointments`
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users.id, indexado |
| doctor | String | requerido |
| specialty | String | requerido |
| datetime | DateTime | fecha/hora de la cita |
| location | String | requerido |
| created_at | DateTime | default now() |
| updated_at | DateTime | auto-actualizado |

Índice compuesto en `(user_id, datetime)`.

## Endpoints de la API

Todas las rutas bajo `/api`. Todas excepto `/api/auth/register` y `/api/auth/login` requieren header `Authorization: Bearer <token>`.

### Auth
- `POST /api/auth/register` — body `{ name, email, password }` → `201 { user: { id, name, email }, token }`. Email duplicado → `409`.
- `POST /api/auth/login` — body `{ email, password }` → `200 { user: { id, name, email }, token }`. Credenciales inválidas → `401`.
- `GET /api/auth/me` — protegido → `200 { id, name, email }`.

### Symptoms
- `GET /api/symptoms?page=&limit=&from=&to=` — `200 { data: [...], pagination: { page, limit, total } }`, filtrado y paginado, solo del usuario autenticado.
- `POST /api/symptoms` — body `{ datetime, description, intensity }` → `201`.
- `GET /api/symptoms/:id` — `200` o `404` si no existe o no pertenece al usuario.
- `PUT /api/symptoms/:id` — actualiza campos → `200` o `404`.
- `DELETE /api/symptoms/:id` — `204` o `404`.

### Medications
- `GET /api/medications?page=&limit=` — `200` paginado, solo del usuario autenticado.
- `POST /api/medications` — body `{ name, dosage, frequency }` → `201`.
- `GET /api/medications/:id` — `200` o `404`.
- `PUT /api/medications/:id` — `200` o `404`.
- `DELETE /api/medications/:id` — `204` o `404` (cascada: borra también sus `medication_logs`).
- `POST /api/medications/:id/logs` — body `{ date, taken }` → upsert por `(medication_id, date)` → `200`.
- `GET /api/medications/:id/logs?from=&to=` — historial de adherencia → `200 { data: [...] }`.

### Appointments
- `GET /api/appointments?page=&limit=&from=&to=` — `200` paginado, solo del usuario autenticado.
- `POST /api/appointments` — body `{ doctor, specialty, datetime, location }` → `201`.
- `GET /api/appointments/:id` — `200` o `404`.
- `PUT /api/appointments/:id` — `200` o `404`.
- `DELETE /api/appointments/:id` — `204` o `404`.

### Convención de errores

Toda respuesta de error tiene la forma:
```json
{ "error": { "message": "string legible", "code": "SNAKE_CASE_CODE", "details": [] } }
```
`details` solo se llena en errores de validación (400), con un elemento por campo inválido.

## Seguridad

- Contraseñas: nunca en texto plano ni en logs; `bcrypt` con 12 rounds.
- Autorización por recurso: todo query a `symptoms`/`medications`/`appointments`/`medication_logs` filtra por `user_id` derivado del JWT (`req.user.id`), nunca del body/params. Si el recurso existe pero pertenece a otro usuario → `404` (no `403`), para no filtrar existencia de datos ajenos.
- `express-rate-limit`: máximo 10 requests / 15 min por IP en `/api/auth/*`.
- Secrets (`JWT_SECRET`, `DATABASE_URL`) solo vía variables de entorno, cargadas con `dotenv`; `.env.example` con placeholders committeado, `.env` real ignorado por git.
- `helmet` habilitado globalmente; `cors` configurado con origen explícito (`FRONTEND_URL`, default `http://localhost:5173` en desarrollo).

## Escalabilidad

- Paginación obligatoria (`page`/`limit`, default `limit=20`, máximo `limit=100`) en todos los listados.
- Filtro por rango de fechas (`from`/`to`) en símptomas y citas.
- Índices en todas las FKs y en las columnas de fecha usadas para filtrar.
- Prisma gestiona el pool de conexiones a Postgres por defecto.

## Estructura de carpetas

```
server/
  src/
    config/
      db.js              # cliente Prisma singleton
    controllers/
      auth.controller.js
      symptoms.controller.js
      medications.controller.js
      appointments.controller.js
    middlewares/
      auth.middleware.js       # valida JWT, adjunta req.user
      error.middleware.js      # manejador de errores centralizado
      validate.middleware.js   # aplica un Zod schema a req.body/req.query
    routes/
      auth.routes.js
      symptoms.routes.js
      medications.routes.js
      appointments.routes.js
      index.js
    schemas/
      auth.schema.js
      symptom.schema.js
      medication.schema.js
      appointment.schema.js
    app.js               # configuración de Express (middlewares globales, montaje de rutas)
    server.js             # entry point, arranca el servidor HTTP
  prisma/
    schema.prisma
    migrations/
  tests/
    auth.test.js
    symptoms.test.js
    medications.test.js
    appointments.test.js
  docker-compose.yml       # servicio Postgres para desarrollo/test
  .env.example
  package.json
```

## Testing

Jest + Supertest, un archivo de test de integración por recurso. Cada test golpea la API real (`app.js` importado sin `listen()`) contra la base de datos de test levantada por Docker Compose, limpiando las tablas relevantes entre tests. Cobertura mínima por recurso: caso feliz de cada endpoint, validación fallida (400), no autenticado (401), acceso a recurso ajeno (404), y (solo en auth) email duplicado (409) y credenciales inválidas (401).

## Decisiones explícitas fuera de alcance

- Recuperación de contraseña / verificación de email por correo.
- Refresh tokens (solo access token de expiración media).
- Integración del frontend (`src/`) con esta API — permanece en `localStorage` hasta una fase futura separada.
