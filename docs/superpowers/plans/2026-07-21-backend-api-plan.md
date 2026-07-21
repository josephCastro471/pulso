# Pulso Backend API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready RESTful API (`server/`) in Node.js + Express, backed by PostgreSQL via Prisma, providing JWT authentication and CRUD for symptoms, medications (with daily adherence logs), and appointments — ready to eventually replace the frontend's `localStorage` persistence.

**Architecture:** Layered Express app (`routes` → `middlewares` → `controllers` → Prisma `config/db.js`), with Zod validating every request body/query before it reaches a controller, a single `AppError`-based error type flowing to one centralized error handler, and every resource query scoped to `req.user.id` (set by JWT auth middleware) so users can never read or write another user's data.

**Tech Stack:** Node.js, Express 4, PostgreSQL 16 (Docker Compose for local dev/test), Prisma (schema + migrations + client), `jsonwebtoken`, `bcryptjs`, Zod, `helmet`, `cors`, `express-rate-limit`, `morgan`, Jest + Supertest.

## Global Constraints

- `server/` is a standalone Node package with its own `package.json`, using **CommonJS** (`require`/`module.exports`) — deliberately different from the root frontend's ESM (`"type": "module"`), chosen because Jest + CommonJS has zero configuration friction versus Jest + native ESM.
- Node.js >= 18.18.0.
- Password hashing: `bcryptjs` (pure JS, no native compilation — avoids build-tool requirements on Windows dev machines) with 12 salt rounds.
- JWT: access-token only (no refresh tokens), signed HS256, `expiresIn` from `JWT_EXPIRES_IN` env var (default `7d`), payload `{ sub: userId }`, secret from `JWT_SECRET` env var — never hardcoded.
- Every protected route requires header `Authorization: Bearer <token>`; the auth middleware sets `req.user = { id }`.
- Ownership checks on every resource (`symptoms`, `medications`, `medication_logs`, `appointments`): if a record exists but belongs to a different user, respond `404` (never `403`) — do not leak existence of other users' data.
- Pagination on all list endpoints: query params `page` (default 1, min 1) and `limit` (default 20, max 100); response shape `{ data: [...], pagination: { page, limit, total } }`.
- Error response shape, always: `{ "error": { "message": "string", "code": "SNAKE_CASE", "details": [] } }`. `details` is only non-empty for `400 VALIDATION_ERROR` responses, one entry per invalid field: `{ field, message }`.
- Out of scope: password reset / email verification, refresh tokens, frontend integration (the React Contexts keep using `localStorage` until a future, separate plan).
- Testing: Jest + Supertest, real Postgres (no mocked DB) via a `pulso_test` database in the same Docker Compose Postgres container; every test file cleans the relevant tables in a shared `afterEach` hook.
- Secrets (`JWT_SECRET`, `DATABASE_URL`, `TEST_DATABASE_URL`) only via environment variables loaded by `dotenv`; `.env.example` is committed with placeholders, the real `.env` is git-ignored (already covered by the root `.gitignore`'s unscoped `.env` and `node_modules` patterns, which match at any depth including `server/`).

---

### Task 1: Scaffold server/ project and Docker Compose Postgres

**Files:**
- Create: `server/package.json`
- Create: `server/.env.example`
- Create: `server/docker-compose.yml`
- Create: `server/.gitignore`

**Interfaces:**
- Produces: `server/` directory as the npm project root for every later task (`cd server && npm install/test/run` all execute here). Docker Compose service name `postgres`, dev DB `pulso_dev`, test DB `pulso_test`, user `pulso` / password `pulso_dev_password`, port `5432`.

- [ ] **Step 1: Create the server package.json**

```json
{
  "name": "pulso-server",
  "private": true,
  "version": "0.0.0",
  "main": "src/server.js",
  "scripts": {
    "dev": "node --watch src/server.js",
    "start": "node src/server.js",
    "test": "jest --runInBand",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "db:up": "docker compose up -d",
    "db:down": "docker compose down"
  },
  "dependencies": {
    "@prisma/client": "^6.4.0",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "express-rate-limit": "^7.5.0",
    "helmet": "^8.0.0",
    "jsonwebtoken": "^9.0.2",
    "morgan": "^1.10.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "prisma": "^6.4.0",
    "supertest": "^7.0.0"
  }
}
```

- [ ] **Step 2: Create the Docker Compose file for local Postgres**

`server/docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: pulso_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: pulso
      POSTGRES_PASSWORD: pulso_dev_password
      POSTGRES_DB: pulso_dev
    ports:
      - "5432:5432"
    volumes:
      - pulso_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U pulso -d pulso_dev"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pulso_postgres_data:
```

- [ ] **Step 3: Create the env example file**

`server/.env.example`:

```
DATABASE_URL="postgresql://pulso:pulso_dev_password@localhost:5432/pulso_dev"
TEST_DATABASE_URL="postgresql://pulso:pulso_dev_password@localhost:5432/pulso_test"
JWT_SECRET="replace-with-a-long-random-secret"
JWT_EXPIRES_IN="7d"
PORT=4000
FRONTEND_URL="http://localhost:5173"
```

- [ ] **Step 4: Create server/.gitignore (belt-and-suspenders alongside the root .gitignore)**

`server/.gitignore`:

```
node_modules
.env
```

- [ ] **Step 5: Copy the env example to a real .env for local use**

Run (from `server/`):
```bash
cp .env.example .env
```
Then edit `server/.env` and replace `JWT_SECRET` with a long random string (e.g. output of `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).

- [ ] **Step 6: Install dependencies**

Run (from `server/`):
```bash
npm install
```
Expected: `node_modules/` created, no errors (bcryptjs is pure JS, so this should not require any native build step).

- [ ] **Step 7: Start Postgres and create the test database**

Run (from `server/`):
```bash
docker compose up -d
docker compose ps
```
Expected: `pulso_postgres` shows `healthy` status (may take a few seconds — re-run `docker compose ps` if it still says `starting`).

Then create the second database used by the test suite:
```bash
docker compose exec postgres psql -U pulso -d pulso_dev -c "CREATE DATABASE pulso_test;"
```
Expected output: `CREATE DATABASE`

- [ ] **Step 8: Stop the containers (they'll be started again when needed)**

Run:
```bash
docker compose down
```
Expected: containers stopped and removed, named volume `pulso_postgres_data` persists.

- [ ] **Step 9: Commit**

```bash
git add server/package.json server/docker-compose.yml server/.env.example server/.gitignore
git commit -m "chore: scaffold server/ project and Docker Compose Postgres"
```

(Note: `server/package-lock.json` and `server/node_modules/` are created by `npm install` — the lockfile should also be committed; add it in the same commit if present: `git add server/package-lock.json`.)

---

### Task 2: Prisma schema and initial migration

**Files:**
- Create: `server/prisma/schema.prisma`

**Interfaces:**
- Consumes: `DATABASE_URL` env var (Task 1).
- Produces: Prisma models `User`, `Symptom`, `Medication`, `MedicationLog`, `Appointment` and a generated `@prisma/client` usable as `new PrismaClient()`. Field names on the generated client use camelCase (`passwordHash`, `userId`, `medicationId`, `createdAt`, `updatedAt`) mapped to snake_case DB columns via `@map`/`@@map`. Compound unique key on `MedicationLog` is named `medicationId_date` (Prisma's default join of the two field names), used later as `where: { medicationId_date: { medicationId, date } }`.

- [ ] **Step 1: Write the Prisma schema**

`server/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(uuid())
  name         String
  email        String   @unique
  passwordHash String   @map("password_hash")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  symptoms     Symptom[]
  medications  Medication[]
  appointments Appointment[]

  @@map("users")
}

model Symptom {
  id          String   @id @default(uuid())
  userId      String   @map("user_id")
  datetime    DateTime
  description String
  intensity   Int
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, datetime])
  @@map("symptoms")
}

model Medication {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  name      String
  dosage    String
  frequency String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  logs MedicationLog[]

  @@index([userId])
  @@map("medications")
}

model MedicationLog {
  id           String   @id @default(uuid())
  medicationId String   @map("medication_id")
  date         DateTime @db.Date
  taken        Boolean  @default(false)
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  medication Medication @relation(fields: [medicationId], references: [id], onDelete: Cascade)

  @@unique([medicationId, date])
  @@index([medicationId])
  @@map("medication_logs")
}

model Appointment {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  doctor    String
  specialty String
  datetime  DateTime
  location  String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, datetime])
  @@map("appointments")
}
```

Note: `intensity`'s 1-5 range is enforced at the application layer (Zod, Task 8) rather than a DB check constraint — Prisma's schema language doesn't support arbitrary check constraints in the version pinned here.

- [ ] **Step 2: Start Postgres**

Run (from `server/`):
```bash
docker compose up -d
```
Expected: `docker compose ps` shows `pulso_postgres` healthy (wait a few seconds if still starting).

- [ ] **Step 3: Run the initial migration**

Run (from `server/`):
```bash
npx prisma migrate dev --name init
```
Expected: output ending in `Your database is now in sync with your schema.` and a new folder `server/prisma/migrations/<timestamp>_init/migration.sql`.

- [ ] **Step 4: Generate the Prisma client**

Run (from `server/`):
```bash
npx prisma generate
```
Expected: `Generated Prisma Client ... to ./node_modules/@prisma/client`.

- [ ] **Step 5: Smoke-test the schema end-to-end**

Run (from `server/`):
```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const user = await prisma.user.create({ data: { name: 'Smoke Test', email: 'smoke@example.com', passwordHash: 'x' } });
  const symptom = await prisma.symptom.create({ data: { userId: user.id, datetime: new Date(), description: 'test', intensity: 3 } });
  const medication = await prisma.medication.create({ data: { userId: user.id, name: 'Test Med', dosage: '1', frequency: 'daily' } });
  const log = await prisma.medicationLog.create({ data: { medicationId: medication.id, date: new Date(), taken: true } });
  const appointment = await prisma.appointment.create({ data: { userId: user.id, doctor: 'Dr. Test', specialty: 'Test', datetime: new Date(), location: 'Test' } });
  console.log('created:', { user: user.id, symptom: symptom.id, medication: medication.id, log: log.id, appointment: appointment.id });
  await prisma.user.delete({ where: { id: user.id } });
  console.log('cascade delete of user succeeded (symptoms/medications/logs/appointments cascaded)');
  await prisma.\$disconnect();
})();
"
```
Expected: prints the created IDs, then `cascade delete of user succeeded ...`, no errors. This confirms the relations, the compound unique key, and `onDelete: Cascade` all work.

- [ ] **Step 6: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations
git commit -m "feat: add Prisma schema with users, symptoms, medications, medication_logs, appointments"
```

---

### Task 3: Express app skeleton, security middlewares, and Jest/Supertest setup

**Files:**
- Create: `server/src/utils/AppError.js`
- Create: `server/src/middlewares/error.middleware.js`
- Create: `server/src/routes/index.js`
- Create: `server/src/app.js`
- Create: `server/src/server.js`
- Create: `server/src/config/db.js`
- Create: `server/jest.config.js`
- Create: `server/tests/setupEnv.js`
- Create: `server/tests/cleanup.js`
- Create: `server/tests/helpers/app.js`
- Test: `server/tests/health.test.js`

**Interfaces:**
- Consumes: `PrismaClient` from `@prisma/client` (Task 2), env vars `DATABASE_URL`/`TEST_DATABASE_URL`/`PORT`/`FRONTEND_URL` (Task 1).
- Produces: `createApp()` (default export of `src/app.js`) returning a configured Express app with `helmet`, `cors`, `morgan`, `express.json()`, a mounted `GET /api/health`, all future `/api/*` routes, a 404 fallback, and the error middleware last. `AppError` class: `new AppError(statusCode, code, message, details = [])` with `.statusCode`/`.code`/`.message`/`.details`. `errorMiddleware(err, req, res, next)`. `prisma` singleton default export of `src/config/db.js`. `tests/helpers/app.js` exports a single shared `createApp()` instance for all test files to reuse.

- [ ] **Step 1: Write the failing health check test**

`server/tests/health.test.js`:

```js
const request = require('supertest');
const app = require('./helpers/app');

describe('GET /api/health', () => {
  it('returns ok status', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 2: Create the test support files it depends on**

`server/tests/setupEnv.js`:

```js
process.env.NODE_ENV = 'test';
require('dotenv').config();
```

`server/tests/cleanup.js`:

```js
const prisma = require('../src/config/db');

afterEach(async () => {
  await prisma.medicationLog.deleteMany();
  await prisma.medication.deleteMany();
  await prisma.symptom.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

`server/jest.config.js`:

```js
module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/cleanup.js'],
  testTimeout: 15000,
};
```

`server/tests/helpers/app.js`:

```js
const createApp = require('../../src/app');

module.exports = createApp();
```

- [ ] **Step 3: Run the test to verify it fails**

Run (from `server/`):
```bash
npx jest tests/health.test.js
```
Expected: FAIL — `Cannot find module '../src/app'` (or similar), since `src/app.js` doesn't exist yet.

- [ ] **Step 4: Implement config/db.js**

`server/src/config/db.js`:

```js
const { PrismaClient } = require('@prisma/client');

const databaseUrl = process.env.NODE_ENV === 'test'
  ? process.env.TEST_DATABASE_URL
  : process.env.DATABASE_URL;

const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrl } },
});

module.exports = prisma;
```

- [ ] **Step 5: Implement AppError and the error middleware**

`server/src/utils/AppError.js`:

```js
class AppError extends Error {
  constructor(statusCode, code, message, details = []) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

module.exports = AppError;
```

`server/src/middlewares/error.middleware.js`:

```js
const AppError = require('../utils/AppError');

function errorMiddleware(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { message: err.message, code: err.code, details: err.details },
    });
  }

  if (process.env.NODE_ENV !== 'test') {
    console.error(err);
  }

  return res.status(500).json({
    error: { message: 'Internal server error', code: 'INTERNAL_ERROR', details: [] },
  });
}

module.exports = errorMiddleware;
```

- [ ] **Step 6: Implement the (currently empty) routes index**

`server/src/routes/index.js`:

```js
const express = require('express');

const router = express.Router();

module.exports = router;
```

- [ ] **Step 7: Implement app.js**

`server/src/app.js`:

```js
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const routes = require('./routes');
const errorMiddleware = require('./middlewares/error.middleware');

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api', routes);

  app.use((req, res) => {
    res.status(404).json({ error: { message: 'Ruta no encontrada', code: 'NOT_FOUND', details: [] } });
  });

  app.use(errorMiddleware);

  return app;
}

module.exports = createApp;
```

- [ ] **Step 8: Implement server.js (the runtime entry point, not exercised by tests)**

`server/src/server.js`:

```js
require('dotenv').config();
const createApp = require('./app');

const PORT = process.env.PORT || 4000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`Pulso API escuchando en el puerto ${PORT}`);
});
```

- [ ] **Step 9: Run the test to verify it passes**

Run (from `server/`):
```bash
npx jest tests/health.test.js
```
Expected: PASS (1 test).

- [ ] **Step 10: Commit**

```bash
git add server/src/config/db.js server/src/utils/AppError.js server/src/middlewares/error.middleware.js server/src/routes/index.js server/src/app.js server/src/server.js server/jest.config.js server/tests/setupEnv.js server/tests/cleanup.js server/tests/helpers/app.js server/tests/health.test.js
git commit -m "feat: add Express app skeleton with security middlewares and health check"
```

---

### Task 4: Shared utils — AppError coverage, JWT sign/verify, pagination

**Files:**
- Create: `server/src/utils/jwt.js`
- Create: `server/src/utils/pagination.js`
- Test: `server/tests/utils/AppError.test.js`
- Test: `server/tests/utils/jwt.test.js`
- Test: `server/tests/utils/pagination.test.js`

**Interfaces:**
- Produces: `signToken(userId) => string` and `verifyToken(token) => { sub, iat, exp }` (throws on invalid/expired) from `src/utils/jwt.js`. `parsePagination(query) => { page: number, limit: number, skip: number }` and `parseDateRange(query) => { gte?: Date, lte?: Date } | undefined` from `src/utils/pagination.js`.
- Consumes: `AppError` (Task 3), env vars `JWT_SECRET`/`JWT_EXPIRES_IN`.

- [ ] **Step 1: Write the failing tests**

`server/tests/utils/AppError.test.js`:

```js
const AppError = require('../../src/utils/AppError');

describe('AppError', () => {
  it('stores statusCode, code, message, and details', () => {
    const err = new AppError(404, 'NOT_FOUND', 'No encontrado', [{ field: 'id', message: 'required' }]);
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('No encontrado');
    expect(err.details).toEqual([{ field: 'id', message: 'required' }]);
  });

  it('defaults details to an empty array', () => {
    const err = new AppError(500, 'INTERNAL_ERROR', 'Error interno');
    expect(err.details).toEqual([]);
  });
});
```

`server/tests/utils/jwt.test.js`:

```js
const { signToken, verifyToken } = require('../../src/utils/jwt');

describe('jwt utils', () => {
  it('signs and verifies a token round-trip', () => {
    const token = signToken('user-123');
    const payload = verifyToken(token);
    expect(payload.sub).toBe('user-123');
  });

  it('throws when verifying an invalid token', () => {
    expect(() => verifyToken('not-a-real-token')).toThrow();
  });
});
```

`server/tests/utils/pagination.test.js`:

```js
const { parsePagination, parseDateRange } = require('../../src/utils/pagination');

describe('parsePagination', () => {
  it('defaults to page 1 and limit 20', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it('caps limit at 100', () => {
    expect(parsePagination({ page: '1', limit: '500' })).toEqual({ page: 1, limit: 100, skip: 0 });
  });

  it('computes skip from page and limit', () => {
    expect(parsePagination({ page: '3', limit: '10' })).toEqual({ page: 3, limit: 10, skip: 20 });
  });

  it('treats page below 1 as 1', () => {
    expect(parsePagination({ page: '0' })).toEqual({ page: 1, limit: 20, skip: 0 });
  });
});

describe('parseDateRange', () => {
  it('returns undefined when no from/to given', () => {
    expect(parseDateRange({})).toBeUndefined();
  });

  it('builds a gte/lte filter from from/to', () => {
    const result = parseDateRange({ from: '2026-01-01', to: '2026-01-31' });
    expect(result.gte).toEqual(new Date('2026-01-01'));
    expect(result.lte).toEqual(new Date('2026-01-31'));
  });

  it('builds a filter with only gte when only from is given', () => {
    const result = parseDateRange({ from: '2026-01-01' });
    expect(result).toEqual({ gte: new Date('2026-01-01') });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `server/`):
```bash
npx jest tests/utils
```
Expected: FAIL — `Cannot find module '../../src/utils/jwt'` and `'../../src/utils/pagination'` (AppError test passes already since `AppError.js` exists from Task 3).

- [ ] **Step 3: Implement jwt.js**

`server/src/utils/jwt.js`:

```js
const jwt = require('jsonwebtoken');

function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signToken, verifyToken };
```

- [ ] **Step 4: Implement pagination.js**

`server/src/utils/pagination.js`:

```js
function parsePagination(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const rawLimit = parseInt(query.limit, 10) || 20;
  const limit = Math.min(Math.max(rawLimit, 1), 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function parseDateRange(query) {
  const range = {};
  if (query.from) {
    range.gte = new Date(query.from);
  }
  if (query.to) {
    range.lte = new Date(query.to);
  }
  return Object.keys(range).length > 0 ? range : undefined;
}

module.exports = { parsePagination, parseDateRange };
```

- [ ] **Step 5: Run tests to verify they pass**

Run (from `server/`):
```bash
npx jest tests/utils
```
Expected: PASS (all tests in the 3 files).

- [ ] **Step 6: Commit**

```bash
git add server/src/utils/jwt.js server/src/utils/pagination.js server/tests/utils
git commit -m "feat: add jwt sign/verify and pagination utils with unit tests"
```

---

### Task 5: Auth — register endpoint

**Files:**
- Create: `server/src/schemas/auth.schema.js`
- Create: `server/src/middlewares/validate.middleware.js`
- Create: `server/src/controllers/auth.controller.js`
- Create: `server/src/routes/auth.routes.js`
- Modify: `server/src/routes/index.js`
- Test: `server/tests/auth.test.js`

**Interfaces:**
- Consumes: `AppError` (Task 3), `prisma` (Task 3), `signToken` (Task 4).
- Produces: `validate(schema, source = 'body') => (req, res, next) => void` middleware (parses `req[source]` with Zod, replaces it with the parsed value on success, calls `next(new AppError(400, 'VALIDATION_ERROR', ...))` on failure). `registerSchema`/`loginSchema` (Zod schemas) from `schemas/auth.schema.js`. Controller exports `{ register, login, me }` from `controllers/auth.controller.js` (only `register` implemented this task; `login`/`me` are added in Tasks 6-7 but declared now as `undefined`-safe stubs are NOT used — this task only wires `register`). Route `POST /api/auth/register` mounted at `/api/auth`.

- [ ] **Step 1: Write the failing tests**

`server/tests/auth.test.js`:

```js
const request = require('supertest');
const app = require('./helpers/app');

describe('POST /api/auth/register', () => {
  it('registers a new user and returns a token', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'supersecret123',
    });

    expect(response.status).toBe(201);
    expect(response.body.user).toEqual({ id: expect.any(String), name: 'Ada Lovelace', email: 'ada@example.com' });
    expect(typeof response.body.token).toBe('string');
  });

  it('rejects a duplicate email with 409', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Ada Lovelace',
      email: 'dup@example.com',
      password: 'supersecret123',
    });

    const response = await request(app).post('/api/auth/register').send({
      name: 'Another Name',
      email: 'dup@example.com',
      password: 'supersecret123',
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('rejects invalid input with 400', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: '',
      email: 'not-an-email',
      password: '123',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `server/`):
```bash
npx jest tests/auth.test.js
```
Expected: FAIL with 404 (no `/api/auth/register` route exists yet) instead of 201/409/400.

- [ ] **Step 3: Implement the Zod schema**

`server/src/schemas/auth.schema.js`:

```js
const { z } = require('zod');

const registerSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido'),
  email: z.string().trim().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

const loginSchema = z.object({
  email: z.string().trim().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

module.exports = { registerSchema, loginSchema };
```

- [ ] **Step 4: Implement the validate middleware**

`server/src/middlewares/validate.middleware.js`:

```js
const AppError = require('../utils/AppError');

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new AppError(400, 'VALIDATION_ERROR', 'Datos inválidos', details));
    }
    req[source] = result.data;
    next();
  };
}

module.exports = validate;
```

- [ ] **Step 5: Implement the auth controller (register only)**

`server/src/controllers/auth.controller.js`:

```js
const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const { signToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');

const SALT_ROUNDS = 12;

function toPublicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError(409, 'EMAIL_TAKEN', 'Ya existe una cuenta con ese email');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({ data: { name, email, passwordHash } });

    const token = signToken(user.id);
    res.status(201).json({ user: toPublicUser(user), token });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, toPublicUser };
```

- [ ] **Step 6: Implement the auth routes with rate limiting**

`server/src/routes/auth.routes.js`:

```js
const express = require('express');
const rateLimit = require('express-rate-limit');
const { register } = require('../controllers/auth.controller');
const validate = require('../middlewares/validate.middleware');
const { registerSchema } = require('../schemas/auth.schema');

const router = express.Router();

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Demasiados intentos, intenta de nuevo más tarde', code: 'RATE_LIMITED', details: [] } },
});

router.post('/register', authRateLimiter, validate(registerSchema), register);

module.exports = router;
```

- [ ] **Step 7: Mount auth routes in the routes index**

`server/src/routes/index.js`:

```js
const express = require('express');
const authRoutes = require('./auth.routes');

const router = express.Router();

router.use('/auth', authRoutes);

module.exports = router;
```

- [ ] **Step 8: Run the test to verify it passes**

Run (from `server/`):
```bash
npx jest tests/auth.test.js
```
Expected: PASS (3 tests).

- [ ] **Step 9: Commit**

```bash
git add server/src/schemas/auth.schema.js server/src/middlewares/validate.middleware.js server/src/controllers/auth.controller.js server/src/routes/auth.routes.js server/src/routes/index.js server/tests/auth.test.js
git commit -m "feat: add auth register endpoint with JWT and rate limiting"
```

---

### Task 6: Auth — login endpoint

**Files:**
- Modify: `server/src/controllers/auth.controller.js`
- Modify: `server/src/routes/auth.routes.js`
- Modify: `server/tests/auth.test.js`

**Interfaces:**
- Consumes: `toPublicUser` (Task 5, now exported), `loginSchema` (Task 5), `bcrypt.compare` (bcryptjs).
- Produces: adds `login` to the `auth.controller.js` exports (`{ register, login, toPublicUser }`); route `POST /api/auth/login`.

- [ ] **Step 1: Add the failing tests**

Append to `server/tests/auth.test.js` (after the existing `describe('POST /api/auth/register', ...)` block, still inside the same file):

```js

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Grace Hopper',
      email: 'grace@example.com',
      password: 'supersecret123',
    });

    const response = await request(app).post('/api/auth/login').send({
      email: 'grace@example.com',
      password: 'supersecret123',
    });

    expect(response.status).toBe(200);
    expect(typeof response.body.token).toBe('string');
    expect(response.body.user.email).toBe('grace@example.com');
  });

  it('rejects wrong password with 401', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Grace Hopper',
      email: 'grace2@example.com',
      password: 'supersecret123',
    });

    const response = await request(app).post('/api/auth/login').send({
      email: 'grace2@example.com',
      password: 'wrongpassword',
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects an unknown email with 401', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: 'whatever123',
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `server/`):
```bash
npx jest tests/auth.test.js
```
Expected: FAIL — `POST /api/auth/login` returns 404 (route doesn't exist yet).

- [ ] **Step 3: Add the login function to the controller**

Modify `server/src/controllers/auth.controller.js` — add this function above `module.exports` and update the export line:

```js
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email o contraseña incorrectos');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email o contraseña incorrectos');
    }

    const token = signToken(user.id);
    res.status(200).json({ user: toPublicUser(user), token });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, toPublicUser };
```

- [ ] **Step 4: Add the login route**

Modify `server/src/routes/auth.routes.js`:

```js
const express = require('express');
const rateLimit = require('express-rate-limit');
const { register, login } = require('../controllers/auth.controller');
const validate = require('../middlewares/validate.middleware');
const { registerSchema, loginSchema } = require('../schemas/auth.schema');

const router = express.Router();

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Demasiados intentos, intenta de nuevo más tarde', code: 'RATE_LIMITED', details: [] } },
});

router.post('/register', authRateLimiter, validate(registerSchema), register);
router.post('/login', authRateLimiter, validate(loginSchema), login);

module.exports = router;
```

- [ ] **Step 5: Run the test to verify it passes**

Run (from `server/`):
```bash
npx jest tests/auth.test.js
```
Expected: PASS (6 tests total).

- [ ] **Step 6: Commit**

```bash
git add server/src/controllers/auth.controller.js server/src/routes/auth.routes.js server/tests/auth.test.js
git commit -m "feat: add auth login endpoint"
```

---

### Task 7: Auth — JWT middleware and GET /api/auth/me

**Files:**
- Create: `server/src/middlewares/auth.middleware.js`
- Modify: `server/src/controllers/auth.controller.js`
- Modify: `server/src/routes/auth.routes.js`
- Modify: `server/tests/auth.test.js`

**Interfaces:**
- Consumes: `verifyToken` (Task 4), `AppError` (Task 3), `prisma` (Task 3).
- Produces: `authMiddleware(req, res, next)` — reads `Authorization: Bearer <token>`, on success sets `req.user = { id: payload.sub }` and calls `next()`, on missing/invalid/expired token calls `next(new AppError(401, 'UNAUTHORIZED', ...))`. This is the middleware every resource route (Tasks 8-11) mounts via `router.use(authMiddleware)`. Adds `me` to the auth controller exports; route `GET /api/auth/me`.

- [ ] **Step 1: Add the failing tests**

Append to `server/tests/auth.test.js`:

```js

describe('GET /api/auth/me', () => {
  it('returns the current user when authenticated', async () => {
    const registerResponse = await request(app).post('/api/auth/register').send({
      name: 'Margaret Hamilton',
      email: 'margaret@example.com',
      password: 'supersecret123',
    });

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${registerResponse.body.token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: expect.any(String), name: 'Margaret Hamilton', email: 'margaret@example.com' });
  });

  it('rejects requests without a token with 401', async () => {
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects requests with a malformed token with 401', async () => {
    const response = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `server/`):
```bash
npx jest tests/auth.test.js
```
Expected: FAIL — `GET /api/auth/me` returns 404 (route doesn't exist yet).

- [ ] **Step 3: Implement the auth middleware**

`server/src/middlewares/auth.middleware.js`:

```js
const { verifyToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Token de autenticación requerido'));
  }

  const token = header.slice('Bearer '.length);
  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub };
    next();
  } catch {
    next(new AppError(401, 'UNAUTHORIZED', 'Token inválido o expirado'));
  }
}

module.exports = authMiddleware;
```

- [ ] **Step 4: Add the me function to the controller**

Modify `server/src/controllers/auth.controller.js` — add above `module.exports` and update the export line:

```js
async function me(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Usuario no encontrado');
    }
    res.status(200).json(toPublicUser(user));
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, me, toPublicUser };
```

- [ ] **Step 5: Add the /me route**

Modify `server/src/routes/auth.routes.js`:

```js
const express = require('express');
const rateLimit = require('express-rate-limit');
const { register, login, me } = require('../controllers/auth.controller');
const validate = require('../middlewares/validate.middleware');
const authMiddleware = require('../middlewares/auth.middleware');
const { registerSchema, loginSchema } = require('../schemas/auth.schema');

const router = express.Router();

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Demasiados intentos, intenta de nuevo más tarde', code: 'RATE_LIMITED', details: [] } },
});

router.post('/register', authRateLimiter, validate(registerSchema), register);
router.post('/login', authRateLimiter, validate(loginSchema), login);
router.get('/me', authMiddleware, me);

module.exports = router;
```

- [ ] **Step 6: Run the test to verify it passes**

Run (from `server/`):
```bash
npx jest tests/auth.test.js
```
Expected: PASS (9 tests total).

- [ ] **Step 7: Commit**

```bash
git add server/src/middlewares/auth.middleware.js server/src/controllers/auth.controller.js server/src/routes/auth.routes.js server/tests/auth.test.js
git commit -m "feat: add JWT auth middleware and GET /api/auth/me"
```

---

### Task 8: Symptoms CRUD

**Files:**
- Create: `server/src/schemas/symptom.schema.js`
- Create: `server/src/controllers/symptoms.controller.js`
- Create: `server/src/routes/symptoms.routes.js`
- Modify: `server/src/routes/index.js`
- Create: `server/tests/helpers/auth.js`
- Test: `server/tests/symptoms.test.js`

**Interfaces:**
- Consumes: `authMiddleware` (Task 7), `validate` (Task 5), `parsePagination`/`parseDateRange` (Task 4), `prisma` (Task 3), `AppError` (Task 3).
- Produces: `tests/helpers/auth.js` exports `createUserAndToken(app, overrides = {}) => Promise<{ token, user }>`, reused by Tasks 9-11's tests. Route `/api/symptoms` (protected): `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`.

- [ ] **Step 1: Write the test helper for authenticated requests**

`server/tests/helpers/auth.js`:

```js
const request = require('supertest');

async function createUserAndToken(app, overrides = {}) {
  const payload = {
    name: 'Test User',
    email: `user-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
    password: 'password123',
    ...overrides,
  };
  const response = await request(app).post('/api/auth/register').send(payload);
  return { token: response.body.token, user: response.body.user };
}

module.exports = { createUserAndToken };
```

- [ ] **Step 2: Write the failing tests**

`server/tests/symptoms.test.js`:

```js
const request = require('supertest');
const app = require('./helpers/app');
const { createUserAndToken } = require('./helpers/auth');

describe('Symptoms API', () => {
  it('creates and lists a symptom for the authenticated user', async () => {
    const { token } = await createUserAndToken(app);

    const createResponse = await request(app)
      .post('/api/symptoms')
      .set('Authorization', `Bearer ${token}`)
      .send({ datetime: new Date().toISOString(), description: 'Dolor de cabeza', intensity: 3 });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.description).toBe('Dolor de cabeza');

    const listResponse = await request(app)
      .get('/api/symptoms')
      .set('Authorization', `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);
    expect(listResponse.body.pagination).toEqual({ page: 1, limit: 20, total: 1 });
  });

  it('rejects invalid intensity with 400', async () => {
    const { token } = await createUserAndToken(app);

    const response = await request(app)
      .post('/api/symptoms')
      .set('Authorization', `Bearer ${token}`)
      .send({ datetime: new Date().toISOString(), description: 'Dolor', intensity: 9 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unauthenticated requests with 401', async () => {
    const response = await request(app).get('/api/symptoms');
    expect(response.status).toBe(401);
  });

  it("returns 404 when accessing another user's symptom", async () => {
    const owner = await createUserAndToken(app);
    const intruder = await createUserAndToken(app);

    const createResponse = await request(app)
      .post('/api/symptoms')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ datetime: new Date().toISOString(), description: 'Mareo', intensity: 2 });

    const response = await request(app)
      .get(`/api/symptoms/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${intruder.token}`);

    expect(response.status).toBe(404);
  });

  it('updates and deletes a symptom', async () => {
    const { token } = await createUserAndToken(app);

    const createResponse = await request(app)
      .post('/api/symptoms')
      .set('Authorization', `Bearer ${token}`)
      .send({ datetime: new Date().toISOString(), description: 'Fatiga', intensity: 4 });

    const updateResponse = await request(app)
      .put(`/api/symptoms/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ intensity: 2 });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.intensity).toBe(2);

    const deleteResponse = await request(app)
      .delete(`/api/symptoms/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteResponse.status).toBe(204);

    const getResponse = await request(app)
      .get(`/api/symptoms/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getResponse.status).toBe(404);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run (from `server/`):
```bash
npx jest tests/symptoms.test.js
```
Expected: FAIL — 404s for every `/api/symptoms` request (route doesn't exist yet).

- [ ] **Step 4: Implement the Zod schemas**

`server/src/schemas/symptom.schema.js`:

```js
const { z } = require('zod');

const symptomBodySchema = z.object({
  datetime: z.string().datetime({ message: 'datetime debe ser ISO 8601' }),
  description: z.string().trim().min(1, 'La descripción es requerida'),
  intensity: z.number().int().min(1, 'La intensidad mínima es 1').max(5, 'La intensidad máxima es 5'),
});

const symptomUpdateSchema = symptomBodySchema.partial();

const symptomQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

module.exports = { symptomBodySchema, symptomUpdateSchema, symptomQuerySchema };
```

- [ ] **Step 5: Implement the controller**

`server/src/controllers/symptoms.controller.js`:

```js
const prisma = require('../config/db');
const AppError = require('../utils/AppError');
const { parsePagination, parseDateRange } = require('../utils/pagination');

async function list(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const datetimeFilter = parseDateRange(req.query);

    const where = {
      userId: req.user.id,
      ...(datetimeFilter ? { datetime: datetimeFilter } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.symptom.findMany({ where, orderBy: { datetime: 'desc' }, skip, take: limit }),
      prisma.symptom.count({ where }),
    ]);

    res.status(200).json({ data, pagination: { page, limit, total } });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { datetime, description, intensity } = req.body;
    const symptom = await prisma.symptom.create({
      data: { userId: req.user.id, datetime: new Date(datetime), description, intensity },
    });
    res.status(201).json(symptom);
  } catch (err) {
    next(err);
  }
}

async function findOwned(id, userId) {
  const symptom = await prisma.symptom.findUnique({ where: { id } });
  if (!symptom || symptom.userId !== userId) {
    return null;
  }
  return symptom;
}

async function getOne(req, res, next) {
  try {
    const symptom = await findOwned(req.params.id, req.user.id);
    if (!symptom) {
      throw new AppError(404, 'NOT_FOUND', 'Síntoma no encontrado');
    }
    res.status(200).json(symptom);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const existing = await findOwned(req.params.id, req.user.id);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Síntoma no encontrado');
    }

    const data = { ...req.body };
    if (data.datetime) {
      data.datetime = new Date(data.datetime);
    }

    const symptom = await prisma.symptom.update({ where: { id: req.params.id }, data });
    res.status(200).json(symptom);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await findOwned(req.params.id, req.user.id);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Síntoma no encontrado');
    }

    await prisma.symptom.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, getOne, update, remove };
```

- [ ] **Step 6: Implement the routes**

`server/src/routes/symptoms.routes.js`:

```js
const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const controller = require('../controllers/symptoms.controller');
const {
  symptomBodySchema,
  symptomUpdateSchema,
  symptomQuerySchema,
} = require('../schemas/symptom.schema');

const router = express.Router();

router.use(authMiddleware);

router.get('/', validate(symptomQuerySchema, 'query'), controller.list);
router.post('/', validate(symptomBodySchema), controller.create);
router.get('/:id', controller.getOne);
router.put('/:id', validate(symptomUpdateSchema), controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
```

- [ ] **Step 7: Mount the symptoms routes**

Modify `server/src/routes/index.js`:

```js
const express = require('express');
const authRoutes = require('./auth.routes');
const symptomsRoutes = require('./symptoms.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/symptoms', symptomsRoutes);

module.exports = router;
```

- [ ] **Step 8: Run the test to verify it passes**

Run (from `server/`):
```bash
npx jest tests/symptoms.test.js
```
Expected: PASS (5 tests).

- [ ] **Step 9: Commit**

```bash
git add server/src/schemas/symptom.schema.js server/src/controllers/symptoms.controller.js server/src/routes/symptoms.routes.js server/src/routes/index.js server/tests/helpers/auth.js server/tests/symptoms.test.js
git commit -m "feat: add symptoms CRUD with pagination and date filtering"
```

---

### Task 9: Medications CRUD (catalog only, no logs yet)

**Files:**
- Create: `server/src/schemas/medication.schema.js`
- Create: `server/src/controllers/medications.controller.js`
- Create: `server/src/routes/medications.routes.js`
- Modify: `server/src/routes/index.js`
- Test: `server/tests/medications.test.js`

**Interfaces:**
- Consumes: `authMiddleware` (Task 7), `validate` (Task 5), `parsePagination` (Task 4), `prisma` (Task 3), `AppError` (Task 3), `createUserAndToken` (Task 8).
- Produces: `medications.controller.js` exports `{ list, create, getOne, update, remove }` (Task 10 adds `upsertLog`/`listLogs` to this same file). Route `/api/medications` (protected): `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`.

- [ ] **Step 1: Write the failing tests**

`server/tests/medications.test.js`:

```js
const request = require('supertest');
const app = require('./helpers/app');
const { createUserAndToken } = require('./helpers/auth');

describe('Medications API', () => {
  it('creates and lists a medication', async () => {
    const { token } = await createUserAndToken(app);

    const createResponse = await request(app)
      .post('/api/medications')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Losartán', dosage: '50mg', frequency: 'cada 24 horas' });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.name).toBe('Losartán');

    const listResponse = await request(app)
      .get('/api/medications')
      .set('Authorization', `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);
    expect(listResponse.body.pagination).toEqual({ page: 1, limit: 20, total: 1 });
  });

  it('rejects invalid input with 400', async () => {
    const { token } = await createUserAndToken(app);

    const response = await request(app)
      .post('/api/medications')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '', dosage: '', frequency: '' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unauthenticated requests with 401', async () => {
    const response = await request(app).get('/api/medications');
    expect(response.status).toBe(401);
  });

  it("returns 404 when accessing another user's medication", async () => {
    const owner = await createUserAndToken(app);
    const intruder = await createUserAndToken(app);

    const createResponse = await request(app)
      .post('/api/medications')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Metformina', dosage: '850mg', frequency: 'cada 12 horas' });

    const response = await request(app)
      .delete(`/api/medications/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${intruder.token}`);

    expect(response.status).toBe(404);
  });

  it('updates and deletes a medication', async () => {
    const { token } = await createUserAndToken(app);

    const createResponse = await request(app)
      .post('/api/medications')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Atorvastatina', dosage: '20mg', frequency: 'cada 24 horas' });

    const updateResponse = await request(app)
      .put(`/api/medications/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ dosage: '40mg' });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.dosage).toBe('40mg');

    const deleteResponse = await request(app)
      .delete(`/api/medications/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteResponse.status).toBe(204);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `server/`):
```bash
npx jest tests/medications.test.js
```
Expected: FAIL — 404s for every `/api/medications` request.

- [ ] **Step 3: Implement the Zod schemas**

`server/src/schemas/medication.schema.js`:

```js
const { z } = require('zod');

const medicationBodySchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido'),
  dosage: z.string().trim().min(1, 'La dosis es requerida'),
  frequency: z.string().trim().min(1, 'La frecuencia es requerida'),
});

const medicationUpdateSchema = medicationBodySchema.partial();

const medicationQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
});

module.exports = { medicationBodySchema, medicationUpdateSchema, medicationQuerySchema };
```

- [ ] **Step 4: Implement the controller**

`server/src/controllers/medications.controller.js`:

```js
const prisma = require('../config/db');
const AppError = require('../utils/AppError');
const { parsePagination } = require('../utils/pagination');

async function list(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const where = { userId: req.user.id };

    const [data, total] = await Promise.all([
      prisma.medication.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.medication.count({ where }),
    ]);

    res.status(200).json({ data, pagination: { page, limit, total } });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, dosage, frequency } = req.body;
    const medication = await prisma.medication.create({
      data: { userId: req.user.id, name, dosage, frequency },
    });
    res.status(201).json(medication);
  } catch (err) {
    next(err);
  }
}

async function findOwned(id, userId) {
  const medication = await prisma.medication.findUnique({ where: { id } });
  if (!medication || medication.userId !== userId) {
    return null;
  }
  return medication;
}

async function getOne(req, res, next) {
  try {
    const medication = await findOwned(req.params.id, req.user.id);
    if (!medication) {
      throw new AppError(404, 'NOT_FOUND', 'Medicamento no encontrado');
    }
    res.status(200).json(medication);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const existing = await findOwned(req.params.id, req.user.id);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Medicamento no encontrado');
    }

    const medication = await prisma.medication.update({ where: { id: req.params.id }, data: req.body });
    res.status(200).json(medication);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await findOwned(req.params.id, req.user.id);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Medicamento no encontrado');
    }

    await prisma.medication.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, getOne, update, remove, findOwned };
```

- [ ] **Step 5: Implement the routes**

`server/src/routes/medications.routes.js`:

```js
const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const controller = require('../controllers/medications.controller');
const {
  medicationBodySchema,
  medicationUpdateSchema,
  medicationQuerySchema,
} = require('../schemas/medication.schema');

const router = express.Router();

router.use(authMiddleware);

router.get('/', validate(medicationQuerySchema, 'query'), controller.list);
router.post('/', validate(medicationBodySchema), controller.create);
router.get('/:id', controller.getOne);
router.put('/:id', validate(medicationUpdateSchema), controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
```

- [ ] **Step 6: Mount the medications routes**

Modify `server/src/routes/index.js`:

```js
const express = require('express');
const authRoutes = require('./auth.routes');
const symptomsRoutes = require('./symptoms.routes');
const medicationsRoutes = require('./medications.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/symptoms', symptomsRoutes);
router.use('/medications', medicationsRoutes);

module.exports = router;
```

- [ ] **Step 7: Run the test to verify it passes**

Run (from `server/`):
```bash
npx jest tests/medications.test.js
```
Expected: PASS (5 tests).

- [ ] **Step 8: Commit**

```bash
git add server/src/schemas/medication.schema.js server/src/controllers/medications.controller.js server/src/routes/medications.routes.js server/src/routes/index.js server/tests/medications.test.js
git commit -m "feat: add medications CRUD"
```

---

### Task 10: Medication daily adherence logs

**Files:**
- Modify: `server/src/schemas/medication.schema.js`
- Modify: `server/src/controllers/medications.controller.js`
- Modify: `server/src/routes/medications.routes.js`
- Modify: `server/tests/medications.test.js`

**Interfaces:**
- Consumes: `findOwned` (Task 9, now exported), `MedicationLog` model with compound unique `medicationId_date` (Task 2).
- Produces: adds `upsertLog`/`listLogs` to `medications.controller.js` exports. Routes `POST /api/medications/:id/logs`, `GET /api/medications/:id/logs`.

- [ ] **Step 1: Add the failing tests**

Append to `server/tests/medications.test.js`:

```js

describe('Medication logs', () => {
  it('upserts a medication log and lists history', async () => {
    const { token } = await createUserAndToken(app);

    const createResponse = await request(app)
      .post('/api/medications')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Atorvastatina', dosage: '20mg', frequency: 'cada 24 horas' });

    const medicationId = createResponse.body.id;

    const logResponse = await request(app)
      .post(`/api/medications/${medicationId}/logs`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-07-21', taken: true });

    expect(logResponse.status).toBe(200);
    expect(logResponse.body.taken).toBe(true);

    const toggleResponse = await request(app)
      .post(`/api/medications/${medicationId}/logs`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-07-21', taken: false });

    expect(toggleResponse.status).toBe(200);
    expect(toggleResponse.body.taken).toBe(false);
    expect(toggleResponse.body.id).toBe(logResponse.body.id);

    const historyResponse = await request(app)
      .get(`/api/medications/${medicationId}/logs`)
      .set('Authorization', `Bearer ${token}`);

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.data).toHaveLength(1);
  });

  it("returns 404 when logging another user's medication", async () => {
    const owner = await createUserAndToken(app);
    const intruder = await createUserAndToken(app);

    const createResponse = await request(app)
      .post('/api/medications')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Ibuprofeno', dosage: '400mg', frequency: 'cada 8 horas' });

    const response = await request(app)
      .post(`/api/medications/${createResponse.body.id}/logs`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .send({ date: '2026-07-21', taken: true });

    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `server/`):
```bash
npx jest tests/medications.test.js
```
Expected: FAIL — `POST /api/medications/:id/logs` and `GET /api/medications/:id/logs` return 404 (routes don't exist yet).

- [ ] **Step 3: Add the log schemas**

Modify `server/src/schemas/medication.schema.js`:

```js
const { z } = require('zod');

const medicationBodySchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido'),
  dosage: z.string().trim().min(1, 'La dosis es requerida'),
  frequency: z.string().trim().min(1, 'La frecuencia es requerida'),
});

const medicationUpdateSchema = medicationBodySchema.partial();

const medicationQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
});

const medicationLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date debe tener formato YYYY-MM-DD'),
  taken: z.boolean(),
});

const medicationLogQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

module.exports = {
  medicationBodySchema,
  medicationUpdateSchema,
  medicationQuerySchema,
  medicationLogSchema,
  medicationLogQuerySchema,
};
```

- [ ] **Step 4: Add the controller functions**

Modify `server/src/controllers/medications.controller.js` — add these two functions above `module.exports` and update the export line:

```js
async function upsertLog(req, res, next) {
  try {
    const medication = await findOwned(req.params.id, req.user.id);
    if (!medication) {
      throw new AppError(404, 'NOT_FOUND', 'Medicamento no encontrado');
    }

    const { date, taken } = req.body;
    const parsedDate = new Date(`${date}T00:00:00.000Z`);

    const log = await prisma.medicationLog.upsert({
      where: { medicationId_date: { medicationId: medication.id, date: parsedDate } },
      update: { taken },
      create: { medicationId: medication.id, date: parsedDate, taken },
    });

    res.status(200).json(log);
  } catch (err) {
    next(err);
  }
}

async function listLogs(req, res, next) {
  try {
    const medication = await findOwned(req.params.id, req.user.id);
    if (!medication) {
      throw new AppError(404, 'NOT_FOUND', 'Medicamento no encontrado');
    }

    const where = { medicationId: medication.id };
    if (req.query.from || req.query.to) {
      where.date = {};
      if (req.query.from) where.date.gte = new Date(`${req.query.from}T00:00:00.000Z`);
      if (req.query.to) where.date.lte = new Date(`${req.query.to}T23:59:59.999Z`);
    }

    const logs = await prisma.medicationLog.findMany({ where, orderBy: { date: 'asc' } });
    res.status(200).json({ data: logs });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, getOne, update, remove, findOwned, upsertLog, listLogs };
```

- [ ] **Step 5: Add the log routes**

Modify `server/src/routes/medications.routes.js`:

```js
const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const controller = require('../controllers/medications.controller');
const {
  medicationBodySchema,
  medicationUpdateSchema,
  medicationQuerySchema,
  medicationLogSchema,
  medicationLogQuerySchema,
} = require('../schemas/medication.schema');

const router = express.Router();

router.use(authMiddleware);

router.get('/', validate(medicationQuerySchema, 'query'), controller.list);
router.post('/', validate(medicationBodySchema), controller.create);
router.get('/:id', controller.getOne);
router.put('/:id', validate(medicationUpdateSchema), controller.update);
router.delete('/:id', controller.remove);
router.post('/:id/logs', validate(medicationLogSchema), controller.upsertLog);
router.get('/:id/logs', validate(medicationLogQuerySchema, 'query'), controller.listLogs);

module.exports = router;
```

- [ ] **Step 6: Run the test to verify it passes**

Run (from `server/`):
```bash
npx jest tests/medications.test.js
```
Expected: PASS (7 tests total).

- [ ] **Step 7: Commit**

```bash
git add server/src/schemas/medication.schema.js server/src/controllers/medications.controller.js server/src/routes/medications.routes.js server/tests/medications.test.js
git commit -m "feat: add medication daily adherence log upsert and history endpoints"
```

---

### Task 11: Appointments CRUD

**Files:**
- Create: `server/src/schemas/appointment.schema.js`
- Create: `server/src/controllers/appointments.controller.js`
- Create: `server/src/routes/appointments.routes.js`
- Modify: `server/src/routes/index.js`
- Test: `server/tests/appointments.test.js`

**Interfaces:**
- Consumes: `authMiddleware` (Task 7), `validate` (Task 5), `parsePagination`/`parseDateRange` (Task 4), `prisma` (Task 3), `AppError` (Task 3), `createUserAndToken` (Task 8).
- Produces: Route `/api/appointments` (protected): `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`.

- [ ] **Step 1: Write the failing tests**

`server/tests/appointments.test.js`:

```js
const request = require('supertest');
const app = require('./helpers/app');
const { createUserAndToken } = require('./helpers/auth');

describe('Appointments API', () => {
  it('creates and lists an appointment', async () => {
    const { token } = await createUserAndToken(app);

    const createResponse = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        doctor: 'Dr. Pérez',
        specialty: 'Cardiología',
        datetime: new Date(Date.now() + 86400000).toISOString(),
        location: 'Clínica Central',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.doctor).toBe('Dr. Pérez');

    const listResponse = await request(app)
      .get('/api/appointments')
      .set('Authorization', `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);
    expect(listResponse.body.pagination).toEqual({ page: 1, limit: 20, total: 1 });
  });

  it('rejects invalid input with 400', async () => {
    const { token } = await createUserAndToken(app);

    const response = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({ doctor: '', specialty: '', datetime: 'not-a-date', location: '' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unauthenticated requests with 401', async () => {
    const response = await request(app).get('/api/appointments');
    expect(response.status).toBe(401);
  });

  it("returns 404 when accessing another user's appointment", async () => {
    const owner = await createUserAndToken(app);
    const intruder = await createUserAndToken(app);

    const createResponse = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        doctor: 'Dr. Gómez',
        specialty: 'Dermatología',
        datetime: new Date(Date.now() + 86400000).toISOString(),
        location: 'Hospital Norte',
      });

    const response = await request(app)
      .put(`/api/appointments/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .send({ location: 'Hackeado' });

    expect(response.status).toBe(404);
  });

  it('updates and deletes an appointment', async () => {
    const { token } = await createUserAndToken(app);

    const createResponse = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        doctor: 'Dr. Ruiz',
        specialty: 'Neurología',
        datetime: new Date(Date.now() + 86400000).toISOString(),
        location: 'Clínica Sur',
      });

    const updateResponse = await request(app)
      .put(`/api/appointments/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ location: 'Clínica Norte' });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.location).toBe('Clínica Norte');

    const deleteResponse = await request(app)
      .delete(`/api/appointments/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteResponse.status).toBe(204);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `server/`):
```bash
npx jest tests/appointments.test.js
```
Expected: FAIL — 404s for every `/api/appointments` request.

- [ ] **Step 3: Implement the Zod schemas**

`server/src/schemas/appointment.schema.js`:

```js
const { z } = require('zod');

const appointmentBodySchema = z.object({
  doctor: z.string().trim().min(1, 'El doctor es requerido'),
  specialty: z.string().trim().min(1, 'La especialidad es requerida'),
  datetime: z.string().datetime({ message: 'datetime debe ser ISO 8601' }),
  location: z.string().trim().min(1, 'La ubicación es requerida'),
});

const appointmentUpdateSchema = appointmentBodySchema.partial();

const appointmentQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

module.exports = { appointmentBodySchema, appointmentUpdateSchema, appointmentQuerySchema };
```

- [ ] **Step 4: Implement the controller**

`server/src/controllers/appointments.controller.js`:

```js
const prisma = require('../config/db');
const AppError = require('../utils/AppError');
const { parsePagination, parseDateRange } = require('../utils/pagination');

async function list(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const datetimeFilter = parseDateRange(req.query);

    const where = {
      userId: req.user.id,
      ...(datetimeFilter ? { datetime: datetimeFilter } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.appointment.findMany({ where, orderBy: { datetime: 'asc' }, skip, take: limit }),
      prisma.appointment.count({ where }),
    ]);

    res.status(200).json({ data, pagination: { page, limit, total } });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { doctor, specialty, datetime, location } = req.body;
    const appointment = await prisma.appointment.create({
      data: { userId: req.user.id, doctor, specialty, datetime: new Date(datetime), location },
    });
    res.status(201).json(appointment);
  } catch (err) {
    next(err);
  }
}

async function findOwned(id, userId) {
  const appointment = await prisma.appointment.findUnique({ where: { id } });
  if (!appointment || appointment.userId !== userId) {
    return null;
  }
  return appointment;
}

async function getOne(req, res, next) {
  try {
    const appointment = await findOwned(req.params.id, req.user.id);
    if (!appointment) {
      throw new AppError(404, 'NOT_FOUND', 'Cita no encontrada');
    }
    res.status(200).json(appointment);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const existing = await findOwned(req.params.id, req.user.id);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Cita no encontrada');
    }

    const data = { ...req.body };
    if (data.datetime) {
      data.datetime = new Date(data.datetime);
    }

    const appointment = await prisma.appointment.update({ where: { id: req.params.id }, data });
    res.status(200).json(appointment);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await findOwned(req.params.id, req.user.id);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Cita no encontrada');
    }

    await prisma.appointment.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, getOne, update, remove };
```

- [ ] **Step 5: Implement the routes**

`server/src/routes/appointments.routes.js`:

```js
const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const controller = require('../controllers/appointments.controller');
const {
  appointmentBodySchema,
  appointmentUpdateSchema,
  appointmentQuerySchema,
} = require('../schemas/appointment.schema');

const router = express.Router();

router.use(authMiddleware);

router.get('/', validate(appointmentQuerySchema, 'query'), controller.list);
router.post('/', validate(appointmentBodySchema), controller.create);
router.get('/:id', controller.getOne);
router.put('/:id', validate(appointmentUpdateSchema), controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
```

- [ ] **Step 6: Mount the appointments routes**

Modify `server/src/routes/index.js`:

```js
const express = require('express');
const authRoutes = require('./auth.routes');
const symptomsRoutes = require('./symptoms.routes');
const medicationsRoutes = require('./medications.routes');
const appointmentsRoutes = require('./appointments.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/symptoms', symptomsRoutes);
router.use('/medications', medicationsRoutes);
router.use('/appointments', appointmentsRoutes);

module.exports = router;
```

- [ ] **Step 7: Run the test to verify it passes**

Run (from `server/`):
```bash
npx jest tests/appointments.test.js
```
Expected: PASS (5 tests).

- [ ] **Step 8: Commit**

```bash
git add server/src/schemas/appointment.schema.js server/src/controllers/appointments.controller.js server/src/routes/appointments.routes.js server/src/routes/index.js server/tests/appointments.test.js
git commit -m "feat: add appointments CRUD"
```

---

### Task 12: Server README and full test suite pass

**Files:**
- Create: `server/README.md`

**Interfaces:**
- Consumes: nothing new — this task only documents and verifies what Tasks 1-11 built.

- [ ] **Step 1: Write the server README**

`server/README.md`:

```markdown
# Pulso API

Backend RESTful de Pulso: Node.js + Express + PostgreSQL (Prisma).

## Requisitos

- Node.js >= 18.18.0
- Docker (para Postgres local)

## Puesta en marcha

\`\`\`bash
cp .env.example .env   # y edita JWT_SECRET
npm install
docker compose up -d
docker compose exec postgres psql -U pulso -d pulso_dev -c "CREATE DATABASE pulso_test;"   # solo la primera vez
npx prisma migrate dev
npm run dev
\`\`\`

La API queda escuchando en `http://localhost:4000` (o el valor de `PORT` en `.env`).

## Tests

\`\`\`bash
npm test
\`\`\`

Los tests corren contra `pulso_test` (Postgres real, no mockeado) y limpian las tablas relevantes después de cada test.

## Endpoints

Ver `docs/superpowers/specs/2026-07-21-backend-api-design.md` en la raíz del repo para la referencia completa de endpoints, modelo de datos y decisiones de seguridad.

## Apagar el entorno

\`\`\`bash
docker compose down
\`\`\`
```

- [ ] **Step 2: Run the entire test suite**

Run (from `server/`, with `docker compose up -d` already running from earlier tasks):
```bash
npm test
```
Expected: all test suites pass — `health.test.js`, `tests/utils/AppError.test.js`, `tests/utils/jwt.test.js`, `tests/utils/pagination.test.js`, `auth.test.js`, `symptoms.test.js`, `medications.test.js`, `appointments.test.js` — Jest reports 8 test suites passed, 0 failed, and every individual test (`it(...)`) passing.

- [ ] **Step 3: Commit**

```bash
git add server/README.md
git commit -m "docs: add server README with setup and test instructions"
```

---

### Task 13: Full manual end-to-end verification

**Files:**
- None (verification only).

**Interfaces:**
- Consumes: the complete API built in Tasks 1-12.

- [ ] **Step 1: Ensure Postgres is running with a clean dev database**

Run (from `server/`):
```bash
docker compose up -d
docker compose ps
```
Expected: `pulso_postgres` healthy.

- [ ] **Step 2: Start the API in dev mode**

Run (from `server/`, in the background/a separate terminal):
```bash
npm run dev
```
Expected: console prints `Pulso API escuchando en el puerto 4000` with no errors.

- [ ] **Step 3: Smoke-test the full flow with curl**

Run (from any shell, with the server from Step 2 still running):
```bash
curl -s http://localhost:4000/api/health
```
Expected: `{"status":"ok"}`

```bash
curl -s -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Manual Test","email":"manual@example.com","password":"password123"}'
```
Expected: `201`-style JSON body with `user` and `token`. Save the token into a shell variable:
```bash
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d '{"email":"manual@example.com","password":"password123"}' | node -e "process.stdin.on('data', d => console.log(JSON.parse(d).token))")
```

```bash
curl -s http://localhost:4000/api/auth/me -H "Authorization: Bearer $TOKEN"
```
Expected: `{"id":"...","name":"Manual Test","email":"manual@example.com"}`

```bash
curl -s -X POST http://localhost:4000/api/symptoms -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"datetime":"2026-07-21T10:00:00.000Z","description":"Dolor de cabeza","intensity":3}'
curl -s http://localhost:4000/api/symptoms -H "Authorization: Bearer $TOKEN"
```
Expected: create returns `201` with the symptom; list returns `{"data":[...1 item...],"pagination":{"page":1,"limit":20,"total":1}}`.

```bash
curl -s -X POST http://localhost:4000/api/medications -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"Losartán","dosage":"50mg","frequency":"cada 24 horas"}'
```
Expected: `201` with the medication; save its `id` into `MED_ID` and confirm logging works:
```bash
curl -s -X POST http://localhost:4000/api/medications/$MED_ID/logs -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"date":"2026-07-21","taken":true}'
```
Expected: `200` with `{"taken":true,...}`.

```bash
curl -s -X POST http://localhost:4000/api/appointments -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"doctor":"Dr. Pérez","specialty":"Cardiología","datetime":"2026-08-01T15:00:00.000Z","location":"Clínica Central"}'
```
Expected: `201` with the appointment.

- [ ] **Step 4: Verify ownership isolation manually**

Register a second user, get their token, and confirm they get `404` trying to read the first user's symptom:
```bash
curl -s -X POST http://localhost:4000/api/auth/register -H "Content-Type: application/json" -d '{"name":"Second User","email":"second@example.com","password":"password123"}'
```
Use the returned token as `TOKEN2`, then:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/api/symptoms/<first-user-symptom-id> -H "Authorization: Bearer $TOKEN2"
```
Expected: `404`.

- [ ] **Step 5: Tear down**

Stop the dev server (Ctrl+C in its terminal), then:
```bash
docker compose down
```
Expected: containers stopped; named volume persists for next time.

- [ ] **Step 6: Report results**

No commit for this task (verification-only) — confirm to the user that `npm test` passes and the manual curl flow above worked with the exact status codes noted.
