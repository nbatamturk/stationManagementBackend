# Demo Workflow

This is the shortest repeatable walkthrough for an internal product demo.

## Before The Demo

1. Run `npm run bootstrap` on a fresh checkout.
2. Copy the env templates and update database URLs plus API base URLs.
3. Run `npm run doctor`.
4. Run `npm run demo:reset`.
5. Start the backend with `npm run dev:backend`.
6. Start the admin panel with `npm run dev:admin`.
7. Start the mobile app with `npm run dev:mobile` if you plan to show the Expo client.

## Demo Accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@evlab.local` | `Admin123!` |
| Operator | `operator@evlab.local` | `Operator123!` |

## Suggested Walkthrough

### Backend Readiness

1. Open `http://localhost:3000/health` to confirm the API is live.
2. Open `http://localhost:3000/docs` to show the live Swagger surface.

### Admin Web

1. Open `http://localhost:3001/login`.
2. Sign in as `admin@evlab.local`.
3. Show the dashboard summary.
4. Open stations and highlight seeded data, filters, and detail pages.
5. Open custom fields or issues to show the broader management workflows.

### Mobile App

1. Confirm `EXPO_PUBLIC_API_BASE_URL` matches the emulator or device path to the backend.
2. Sign in as `operator@evlab.local`.
3. Show station list, station detail, and QR lookup.
4. Create or edit a station, then add a test history or issue record.

## Resetting Between Demos

If demo data drifts or you want a clean slate:

```bash
npm run demo:reset
```

That reapplies migrations and reseeds the backend so the next walkthrough starts from a known state.
