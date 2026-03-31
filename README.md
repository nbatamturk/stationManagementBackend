# Station Management Backend

A centralized backend service for managing EV test stations used by a mobile application.

## Table of Contents
- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [API Endpoints](#api-endpoints)
- [Station Filtering](#station-filtering)
- [Station CSV Import Export](#station-csv-import-export)
- [Seed Accounts](#seed-accounts)
- [Roadmap](#roadmap)

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

## API Endpoints

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

### Station CSV Import/Export
- `GET /exports/stations.csv`
- `POST /imports/stations/preview`
- `POST /imports/stations/apply`

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

## Station CSV Import Export

### Export
- `GET /exports/stations.csv`
- Admin-only
- Uses the station list filter model, including `cf.<key>` filters where applicable
- Exports fixed station columns plus flat custom-field columns using the `cf.<key>` convention
- Always exports all matching rows; `page` and `limit` are ignored for the CSV file

### Preview
- `POST /imports/stations/preview`
- Admin-only
- Accepts `multipart/form-data` with a single CSV file field
- Parses rows and returns a structured preview with valid rows, invalid rows, duplicate risks, unknown columns/custom fields, and apply-ready candidates
- Does not persist station data

### Apply
- `POST /imports/stations/apply`
- Admin-only
- Accepts JSON payload built from preview `candidate` rows
- Uses `code` as the import match key
- Behavior is `upsert`:
  - matching `code` updates the station
  - missing `code` creates a new station
- `qrCode` and `serialNumber` must remain unique; conflicts are returned as failed rows
- Rows with no effective changes are skipped
- Valid create/update rows are applied transactionally

### CSV Column Rules
- Required base columns: `name`, `code`, `qrCode`, `brand`, `model`, `serialNumber`, `powerKw`, `currentType`, `socketType`, `location`
- Optional base columns: `status`, `isArchived`, `lastTestDate`, `notes`
- Accepted read-only columns: `archivedAt`, `createdAt`, `updatedAt`
- Custom field columns must use `cf.<key>`
- Unknown non-custom columns fail preview
- Unknown custom-field columns are reported and fail rows that contain values for them

### Notes
- Exported CSV is designed to round-trip through preview/apply with the current import rules
- Apply revalidates rows, so preview output should be treated as a draft until apply succeeds
- Blank optional values are treated as omitted; this phase does not support clearing existing values through CSV import

## Seed Accounts
- `admin@evlab.local` / `Admin123!`
- `operator@evlab.local` / `Operator123!`

## Roadmap
- Unit + integration test coverage
- API documentation (OpenAPI/Swagger)
- Background import jobs for large files
- Import templates and richer per-field remediation UX
