# Station Management Backend (Phase 1)

A centralized backend service for managing EV test stations used by a mobile application.

## Table of Contents
- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [API Endpoints (Phase 1)](#api-endpoints-phase-1)
- [Station Filtering](#station-filtering)
- [Seed Accounts](#seed-accounts)
- [Roadmap (Phase 2 Suggestions)](#roadmap-phase-2-suggestions)

## Overview
This project provides a modular backend to:
- List, create, update, archive, and delete EV stations
- Manage dynamic custom fields per station
- Track station test history
- Track station issues/fault records
- Provide a simple, extensible JWT-based authentication flow

## Tech Stack
- **Runtime:** Node.js
- **Language:** TypeScript
- **Framework:** Fastify
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM (`drizzle-orm` + `pg`)

## Project Structure

```text
src/
  app.ts
  server.ts
  config/
    env.ts
  db/
    client.ts
    schema.ts
    seed.ts
  modules/
    auth/
    stations/
    custom-fields/
    test-history/
    issues/
    users/
  plugins/
    auth.ts
    error-handler.ts
  utils/
  types/

drizzle/
  *.sql
  meta/

admin-web/
  (optional admin panel app)
```

### Layer Responsibilities
- **routes**: HTTP layer, request/response schema definitions, and route guards/pre-handlers
- **services**: Business logic
- **repositories**: Database access via Drizzle queries
- **plugins**: Shared Fastify behaviors (auth, error handling, etc.)
- **utils**: Shared helper functions

## Getting Started

### 1) Install dependencies
```bash
npm install
```

### 2) Configure environment
```bash
cp .env.example .env
```

### 3) Run database migrations
```bash
npm run db:migrate
```

### 4) Seed sample data
```bash
npm run seed
```

### 5) Start in development mode
```bash
npm run dev
```

## Environment Variables
Use `.env.example` as a reference.

Required core variables:
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `HOST`
- `PORT`

> **Important:** If your database password includes special characters like `/`, `@`, `:`, `#`, `?`, or `%`, make sure they are URL-encoded in `DATABASE_URL`.

## Available Scripts
- `npm run dev` — Run in development mode (`tsx watch`)
- `npm run build` — Compile TypeScript
- `npm run start` — Run compiled app
- `npm run db:generate` — Generate Drizzle migration SQL
- `npm run db:migrate` — Apply migrations
- `npm run db:push` — Push Drizzle schema directly to DB
- `npm run db:studio` — Open Drizzle Studio
- `npm run seed` — Seed sample data
- `npm run db:setup` — Run migrations + seed

## API Endpoints (Phase 1)

### Auth
- `POST /auth/login`
- `GET /auth/me`

### Stations
- `GET /stations`
- `GET /stations/:id`
- `POST /stations`
- `PUT /stations/:id`
- `DELETE /stations/:id`
- `POST /stations/:id/archive`

### Custom Fields
- `GET /custom-fields`
- `POST /custom-fields`
- `PUT /custom-fields/:id`
- `PATCH /custom-fields/:id/active`

### Test History
- `GET /stations/:id/test-history`
- `POST /stations/:id/test-history`

### Issues
- `GET /stations/:id/issues`
- `POST /stations/:id/issues`
- `PATCH /issues/:id/status`

## Station Filtering
Supported filters for `GET /stations`:
- `search`
- `status`
- `brand`
- `currentType`
- `sortBy`
- Dynamic custom-field filters (`cf.<key>=<value>`)

Example:
```http
GET /stations?status=active&cf.firmware_version=v3
```

## Seed Accounts
- `admin@evlab.local` / `Admin123!`
- `operator@evlab.local` / `Operator123!`

## Roadmap (Phase 2 Suggestions)
- Role-based access control (RBAC)
- Pagination + total count metadata
- Unit + integration test coverage
- API documentation (OpenAPI/Swagger)
