# Pulso API

Backend RESTful de Pulso: Node.js + Express + PostgreSQL (Prisma).

## Requisitos

- Node.js >= 18.18.0
- Docker (para Postgres local)

## Puesta en marcha

```bash
cp .env.example .env   # y edita JWT_SECRET
npm install
docker compose up -d
docker compose exec postgres psql -U pulso -d pulso_dev -c "CREATE DATABASE pulso_test;"   # solo la primera vez
npx prisma migrate dev
npm run dev
```

La API queda escuchando en `http://localhost:4000` (o el valor de `PORT` en `.env`).

## Tests

```bash
npm test
```

Los tests corren contra `pulso_test` (Postgres real, no mockeado) y limpian las tablas relevantes después de cada test.

## Endpoints

Ver `docs/superpowers/specs/2026-07-21-backend-api-design.md` en la raíz del repo para la referencia completa de endpoints, modelo de datos y decisiones de seguridad.

## Apagar el entorno

```bash
docker compose down
```
