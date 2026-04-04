# Station Management Platform

Internal EV station management workspace with:

- `backend`: Fastify + TypeScript + PostgreSQL API
- `admin-web`: Next.js admin panel
- `MobileApp`: Expo / React Native client

This repository is set up for lightweight internal adoption: fast local bootstrap, a repeatable demo flow, and basic CI guardrails without introducing deployment or SaaS infrastructure yet.

## 5-Minute Quickstart

### 1. Install dependencies for all apps

```bash
npm run bootstrap
```

### 2. Create local env files

```bash
cp .env.example .env
cp .env.test.example .env.test
cp admin-web/.env.example admin-web/.env.local
cp MobileApp/.env.example MobileApp/.env
```

Update these values before running the stack:

- `DATABASE_URL`
- `TEST_DATABASE_URL`
- `JWT_SECRET`
- `API_BASE_URL`
- `NEXT_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_API_BASE_URL`

### 3. Create local PostgreSQL databases

Example:

```sql
CREATE DATABASE station_mgmt;
CREATE DATABASE station_mgmt_test;
```

### 4. Validate your machine and env setup

```bash
npm run doctor
```

### 5. Migrate and seed demo data

```bash
npm run demo:reset
```

### 6. Start the apps

```bash
npm run dev:backend
npm run dev:admin
npm run dev:mobile
```

Recommended local pairing:

- backend: `http://localhost:3000`
- admin-web: `http://localhost:3001`
- mobile: device or emulator pointing at the backend URL

## Environment Files

| File | Purpose | Minimum required values | Notes |
| --- | --- | --- | --- |
| `.env` | Backend runtime config | `DATABASE_URL`, `JWT_SECRET` | Loaded for normal backend runs. |
| `.env.test` | Local integration test overrides | `TEST_DATABASE_URL` | Loaded after `.env`; keeps test DB config separate from daily dev config. |
| `admin-web/.env.local` | Admin web local config | `API_BASE_URL`, `NEXT_PUBLIC_API_BASE_URL` | Usually both point to `http://localhost:3000` in local development. |
| `MobileApp/.env` | Mobile app local config | `EXPO_PUBLIC_API_BASE_URL` | Use an emulator or LAN-friendly backend URL. |

Important notes:

- `TEST_DATABASE_URL` should point to a dedicated database whose name includes `test`.
- `JWT_SECRET` must be at least 16 characters.
- Mobile base URL depends on where the app is running:
  - iOS simulator: usually `http://localhost:3000`
  - Android emulator: usually `http://10.0.2.2:3000`
  - Physical device: use your machine LAN IP, for example `http://192.168.1.25:3000`

## Daily Commands

### Root / Backend

| Command | What it does |
| --- | --- |
| `npm run bootstrap` | Install root, admin-web, and mobile dependencies |
| `npm run doctor` | Check Node/tooling plus env and local setup readiness |
| `npm run dev:backend` | Start backend in watch mode |
| `npm run dev:admin` | Start admin-web on port `3001` |
| `npm run dev:all` | Start backend and admin-web together |
| `npm run dev:mobile` | Start the Expo dev server |
| `npm run demo:reset` | Apply migrations and reseed demo data |
| `npm run build` | Build the backend |
| `npm test` | Run backend integration tests against `TEST_DATABASE_URL` |
| `npm run check` | Run backend build, admin-web checks, and mobile typecheck |

### Admin Web

| Command | What it does |
| --- | --- |
| `npm --prefix admin-web run dev -- --port 3001` | Start the admin panel locally |
| `npm --prefix admin-web run lint` | Run non-interactive ESLint checks |
| `npm --prefix admin-web run typecheck` | Run TypeScript checks |
| `npm --prefix admin-web run build` | Create a production build |

### MobileApp

| Command | What it does |
| --- | --- |
| `npm --prefix MobileApp run start` | Start the Expo dev server |
| `npm --prefix MobileApp run android` | Launch Android |
| `npm --prefix MobileApp run ios` | Launch iOS |
| `npm --prefix MobileApp run web` | Launch Expo web |
| `npm --prefix MobileApp run typecheck` | Run TypeScript checks |

## Local Run Order

For the least confusing local workflow:

1. Start PostgreSQL.
2. Run `npm run doctor` if this is a fresh machine or env change.
3. Run `npm run demo:reset` if you need a clean demo/dev dataset.
4. Run `npm run dev:backend`.
5. Verify `http://localhost:3000/health`.
6. Run `npm run dev:admin`.
7. Run `npm run dev:mobile`.

If you only need the backend and admin-web together, use:

```bash
npm run dev:all
```

Useful local URLs:

- Health: `http://localhost:3000/health`
- Swagger UI: `http://localhost:3000/docs`
- Admin login: `http://localhost:3001/login`

## Seeded Accounts

After `npm run demo:reset`, these users are available:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@evlab.local` | `Admin123!` |
| Operator | `operator@evlab.local` | `Operator123!` |

There is no seeded viewer account in the demo seed.

## Testing And Guardrails

Run the main local checks with:

```bash
npm run check
```

Run backend integration tests with:

```bash
npm test
```

Notes:

- `npm test` loads `.env` first, then `.env.test` if present.
- Test runs require `TEST_DATABASE_URL`.
- The test runner forces `DATABASE_URL` to `TEST_DATABASE_URL` and will refuse URLs whose database name does not include `test`.
- `npm run doctor` is the fastest way to catch missing env files or incomplete local setup before debugging app behavior.

## Demo Workflow

The repeatable internal walkthrough lives in [docs/demo-workflow.md](/home/burak/Desktop/Test Tools Dev/stationManagementBackend/docs/demo-workflow.md).

Use it when you want a stable team demo or when you need to reset the workspace back to a known seed state.

## Production Process Model

For production, keep backend and admin-web as separate processes and put a reverse proxy in front of them.

Recommended shape:

- PM2 process 1: backend on `127.0.0.1:3000`
- PM2 process 2: admin-web on `127.0.0.1:3001`
- Nginx or Caddy in front:
  - `/` -> admin-web
  - backend on a dedicated API host or routed path, depending on your infrastructure

This repo includes a starter PM2 config at [ecosystem.config.js](/home/burak/Desktop/Test%20Tools%20Dev/stationManagementBackend/ecosystem.config.js).

Typical production flow:

```bash
npm run build
npm --prefix admin-web run build
pm2 start ecosystem.config.js
pm2 save
```

Notes:

- Backend runtime config still comes from root `.env`.
- Admin-web should have `API_BASE_URL` pointing to the backend process.
- If mobile clients or direct browser assets need a public backend origin, set `NEXT_PUBLIC_API_BASE_URL` accordingly in the admin-web environment.

## Current Scope

What is already integrated:

- JWT auth
- station CRUD and filtering
- custom fields
- test history
- issue tracking
- CSV station transfer flows
- admin web management flows
- mobile backend-connected login, station list/detail, QR lookup, create/edit, issue creation, and test history creation

Known limitations kept out of this readiness pass:

- no local/offline station database or sync; the backend remains the source of truth
- background sync
- mobile attachment upload flows
- deployment and production SaaS infrastructure

## License

All rights reserved.

This repository is for viewing purposes only.
No part of this code may be used, copied, modified, or distributed without explicit permission.

Unauthorized use, reproduction, or distribution is strictly prohibited.
