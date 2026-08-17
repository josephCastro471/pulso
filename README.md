# Pulso

Asistente de salud personalizado para gestionar síntomas, medicamentos y citas médicas, con dashboard interactivo.

**Demo en vivo:** https://pulso-olive-beta.vercel.app

## Funcionalidades

- Registro y seguimiento de síntomas.
- Gestión de medicamentos (dosis, recordatorios).
- Agenda de citas médicas.
- Dashboard con gráficas de evolución en tiempo real (Recharts).
- Autenticación con JWT y CRUD completo sobre todos los recursos.

## Stack

**Frontend:** React · Vite · MUI · Recharts
**Backend:** Node.js · Express · JWT
**Base de datos:** PostgreSQL · Prisma

## Arquitectura

Proyecto full-stack, cliente y servidor en el mismo repo:

- `src/` — frontend (React + Vite)
- `server/` — backend (Node.js + Express + Prisma)

## Correr en local

```bash
# Cliente
npm install
npm run dev

# Servidor (en otra terminal)
cd server
npm install
npm run dev
```

Necesitas una instancia de PostgreSQL y las variables de entorno correspondientes configuradas en `server/` (cadena de conexión, secreto de JWT).

## Motivación

Inspirado en el sistema de gestión médica que desarrollé en producción para JucaCoop Solutions (cliente Ceragem) — esta es mi versión personal, construida desde cero, para seguir practicando el mismo dominio (salud) con mi stack principal. Parte del portafolio en https://portafolio-chi-two-81.vercel.app/
