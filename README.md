# Station Management Platform

EV test station management platform consisting of:

- `backend`: Fastify + TypeScript + PostgreSQL API
- `admin-web`: Next.js admin panel
- `MobileApp`: Expo / React Native mobile client

This README is written as an end-to-end runbook so you can clone the repo and start the project locally with minimal guesswork.

## Table of Contents

- [What Is In This Repo](#what-is-in-this-repo)
- [Current Status](#current-status)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Backend Setup](#backend-setup)
- [Admin Web Setup](#admin-web-setup)
- [Mobile App Setup](#mobile-app-setup)
- [Seed Accounts](#seed-accounts)
- [Useful URLs](#useful-urls)
- [Available Scripts](#available-scripts)
- [Testing](#testing)
- [API Notes](#api-notes)
- [Troubleshooting](#troubleshooting)
- [Known Limitations](#known-limitations)

## What Is In This Repo

This project manages EV charging/test stations with:

- JWT-based authentication
- station list/detail APIs
- custom field definitions
- station test history
- station issue/fault tracking
- CSV station import/export
- admin web panel
- mobile app with Phase 2 backend integration
- standard station filters including `brand`, `model`, `status`, and `currentType`

## Current Status

### Backend

Backend is the primary source of truth.

### Admin Web

Admin web is available for authenticated management workflows.

### Mobile App

Mobile Phase 2 integration is in place. These flows use backend:

- login
- token storage
- station create/edit
- station list
- station detail
- QR lookup
- create test history
- create issue record

These are intentionally **not** implemented yet in mobile Phase 2:

- offline sync
- background sync
- attachment upload flows

The old local SQLite prototype still exists in the repo but is no longer the source of truth for integrated mobile flows.

## Tech Stack

### Backend

- Node.js
- TypeScript
- Fastify
- PostgreSQL
- Drizzle ORM
- Zod

### Admin Web

- Next.js 15
- React 19

### Mobile

- Expo SDK 54
- React Native
- Expo Router
- Expo Secure Store

## Repository Structure

```text
.
├── src/                # Backend source
├── test/               # Backend integration tests
├── drizzle/            # SQL migrations
├── admin-web/          # Next.js admin panel
├── MobileApp/          # Expo mobile app
├── .env.example        # Backend env template
└── README.md
```

## Prerequisites

Install these first:

- Node.js 20+ recommended
- npm
- PostgreSQL
- Git

Optional but useful:

- Drizzle Studio capable browser
- Android Studio emulator or physical Android device
- Xcode simulator if running iOS
- Expo Go or a dev build workflow

## Quick Start

If you want the shortest path to a running local environment:

### 1. Clone and install dependencies

```bash
git clone <YOUR_REPO_URL>
cd stationManagementBackend
npm install
cd admin-web && npm install && cd ..
cd MobileApp && npm install && cd ..
```

### 2. Create backend env

```bash
cp .env.example .env
```

Update at least:

- `DATABASE_URL`
- `JWT_SECRET`

### 3. Create PostgreSQL databases

Example:

```sql
CREATE DATABASE station_mgmt;
CREATE DATABASE station_mgmt_test;
```

### 4. Run migrations and seed backend

```bash
npm run db:setup
```

### 5. Start backend

```bash
npm run dev
```

### 6. Start admin web

```bash
cd admin-web
cp .env.example .env.local
npm run dev
```

### 7. Start mobile

```bash
cd MobileApp
cp .env.example .env
npm run start
```

## Backend Setup

### Backend Environment

Create `.env` in the repository root:

```bash
cp .env.example .env
```

Example:

```env
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
LOG_LEVEL=info
TRUST_PROXY=false
JSON_BODY_LIMIT_BYTES=1048576
DATABASE_URL=postgres://postgres:postgres@localhost:5432/station_mgmt
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/station_mgmt_test
JWT_SECRET=change-this-to-a-long-secret
JWT_EXPIRES_IN=1d
LOGIN_RATE_LIMIT_MAX_ATTEMPTS=5
LOGIN_RATE_LIMIT_WINDOW_MS=900000
LOGIN_RATE_LIMIT_BLOCK_MS=900000
UPLOADS_DIR=uploads
ATTACHMENTS_MAX_FILE_SIZE_BYTES=10485760
```

### Important Env Notes

- `DATABASE_URL` must be a valid `postgres://` or `postgresql://` URL.
- If your DB password contains characters like `/`, `@`, `:`, `#`, `?`, encode them in the URL.
- `JWT_SECRET` must be at least 16 characters.
- Integration tests use `TEST_DATABASE_URL` when present.

### Database Setup

Apply migrations:

```bash
npm run db:migrate
```

Seed example data:

```bash
npm run seed
```

Or do both:

```bash
npm run db:setup
```

### Run Backend

Development mode:

```bash
npm run dev
```

Production build:

```bash
npm run build
npm run start
```

## Admin Web Setup

Admin web lives in `admin-web/`.

### Admin Web Env

```bash
cd admin-web
cp .env.example .env.local
```

Example:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

### Run Admin Web

```bash
cd admin-web
npm install
npm run dev
```

Default local URL:

- `http://localhost:3001` if you start it with a custom port
- otherwise Next.js typically uses `http://localhost:3000`, so if backend is also on `3000`, run admin web on another port:

```bash
npm run dev -- --port 3001
```

Recommended local pairing:

- backend: `http://localhost:3000`
- admin web: `http://localhost:3001`

If you run admin web on `3001`, `NEXT_PUBLIC_API_BASE_URL` should still point to backend on `3000`.

## Mobile App Setup

Mobile app lives in `MobileApp/`.

### Mobile Env

```bash
cd MobileApp
cp .env.example .env
```

Example:

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
```

### API Base URL Notes

`EXPO_PUBLIC_API_BASE_URL` must point to the backend from the perspective of the device/emulator:

- iOS simulator: usually `http://localhost:3000`
- Android emulator: usually `http://10.0.2.2:3000`
- physical phone: use your machine's LAN IP, for example `http://192.168.1.25:3000`

If mobile login or station fetch fails while backend is running, the first thing to verify is this URL.

### Run Mobile App

```bash
cd MobileApp
npm install
npm run start
```

Then choose one:

```bash
npm run android
```

or

```bash
npm run ios
```

or

```bash
npm run web
```

### Mobile Permissions

The mobile app uses camera permission for QR scanning.

### Mobile Phase 2 Behavior

Backend-connected mobile flows:

- sign in
- restore saved session
- sign out
- station create/edit
- station list and filters
- station detail
- QR station lookup
- add test record
- add issue record

Deferred mobile flows:

- offline sync
- attachment upload

## Seed Accounts

After `npm run seed`, these users are available:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@evlab.local` | `Admin123!` |
| Operator | `operator@evlab.local` | `Operator123!` |

There is no seeded viewer account by default.

## Useful URLs

Assuming backend runs on `http://localhost:3000`:

- Health check: `http://localhost:3000/health`
- Swagger UI: `http://localhost:3000/docs`
- Admin web login: `http://localhost:3001/login` if you run Next on port `3001`

## Available Scripts

### Root / Backend

| Command | Description |
| --- | --- |
| `npm run dev` | Start backend in watch mode |
| `npm run build` | Build backend |
| `npm run start` | Run built backend |
| `npm run test` | Run integration tests |
| `npm run test:integration` | Run integration tests explicitly |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Apply migrations |
| `npm run db:push` | Push schema directly |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run seed` | Seed sample data |
| `npm run db:setup` | Migrate + seed |

### Admin Web

| Command | Description |
| --- | --- |
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Build admin web |
| `npm run start` | Start production server |
| `npm run lint` | Run lint task |

### MobileApp

| Command | Description |
| --- | --- |
| `npm run start` | Start Expo dev server |
| `npm run android` | Start Expo for Android |
| `npm run ios` | Start Expo for iOS |
| `npm run web` | Start Expo web |

## Testing

Run backend integration tests:

```bash
npm test
```

or:

```bash
npm run test:integration
```

Notes:

- tests expect a reachable PostgreSQL database
- `TEST_DATABASE_URL` is required for integration tests and is used as the active `DATABASE_URL`
- the test command runs migrations before executing tests

## API Notes

### Response Format

Successful responses use one of:

```json
{ "data": { } }
```

or

```json
{ "data": [], "meta": { } }
```

Errors use:

```json
{ "code": "SOME_ERROR", "message": "Readable message", "details": {} }
```

Explicit non-wrapper exceptions:

- `GET /health` returns `{ "status": "ok", "timestamp": "..." }`
- `GET /attachments/:id/download` streams the raw attachment body
- `GET /exports/stations.csv` streams raw CSV content

Attachment upload endpoints may also return `415 Unsupported Media Type` with the standard error envelope when the uploaded file type is not supported.

### Auth

Login:

```http
POST /auth/login
```

Current user:

```http
GET /auth/me
Authorization: Bearer <accessToken>
```

### Main API Groups

- `Auth`
- `Stations`
- `Custom Fields`
- `Test History`
- `Issues`
- `Attachments`
- `Users`
- `Audit Logs`
- `Dashboard`
- `Station Transfer`

Full live API reference is available in Swagger at `/docs`.

## Troubleshooting

### Backend says environment validation failed

Check:

- `.env` exists in repo root
- `DATABASE_URL` is valid
- `JWT_SECRET` is at least 16 characters

### Connection refused to PostgreSQL

Check:

- PostgreSQL is running
- database names exist
- user/password in `DATABASE_URL` are correct
- port is reachable

### Admin web opens but login fails

Check:

- backend is running
- `admin-web/.env.local` has the correct `NEXT_PUBLIC_API_BASE_URL`
- seeded users exist

If needed, reseed:

```bash
npm run seed
```

### Mobile app cannot log in or fetch stations

Most common cause is wrong `EXPO_PUBLIC_API_BASE_URL`.

Examples:

- Android emulator: `http://10.0.2.2:3000`
- physical device: `http://<your-local-ip>:3000`

Also verify backend CORS/network accessibility from the device.

### Port collision on 3000

If backend uses `3000`, run admin web on another port:

```bash
cd admin-web
npm run dev -- --port 3001
```

### Integration tests are using the wrong database

Set `TEST_DATABASE_URL` in root `.env` so test runs do not reuse your development database.

## Known Limitations

- Offline sync is not implemented.
- Mobile attachments flow is not implemented.
- Some prototype/local SQLite infrastructure remains in the mobile codebase for non-integrated areas.

## Suggested Local Run Order

For daily development, this is the least confusing order:

1. Start PostgreSQL
2. Start backend with `npm run dev`
3. Verify `http://localhost:3000/health`
4. Start admin web
5. Start mobile app
6. Sign in with a seeded account

That gives you a stable local environment for backend, web, and mobile together.
