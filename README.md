# NanoDashboard

Trading-style fullstack dashboard built as a take-home assignment for a Mid-Senior Fullstack Developer role.

NanoDashboard combines a React frontend with a NestJS backend to deliver a small but reviewable product slice: an interactive dashboard workspace on the client, and a backend that owns auth, market-data integration, caching, realtime delivery, and dashboard aggregation. The intent was to show product thinking and architecture discipline, not just isolated demo screens or CRUD endpoints.

## Live Demo

- Frontend: `https://nano-dashboard-pi.vercel.app/`
- Backend: `https://dynamic-embrace-production.up.railway.app`
- Swagger UI: `https://dynamic-embrace-production.up.railway.app/api/docs`
- OpenAPI JSON: `https://dynamic-embrace-production.up.railway.app/api/docs-json`
- Thai overview: [README.th.md](./README.th.md)

## Project Snapshot

| Area | What is implemented |
| --- | --- |
| Frontend | Drag/resize dashboard widgets, chart composition, realtime updates, resizable table columns |
| Backend | JWT auth, refresh token flow, users CRUD, dashboard aggregation, market-data normalization |
| Realtime | User events plus BTC price/volume updates |
| Reliability | Retry, timeout, hot/stale Redis cache, degraded-state fallback |
| Reviewability | Swagger/OpenAPI, Postman collection, tests across backend/frontend/e2e |

## Why This Project Is Structured This Way

The frontend is intentionally UI-focused. It should not need to know Binance response shapes, retry behavior, cache key strategy, or upstream quirks. That complexity is absorbed by the backend and exposed as dashboard-specific contracts such as `GET /api/dashboard/summary`.

The backend is implemented as a modular monolith. That gives clear service boundaries for review without paying the operational cost of microservices in a take-home assignment.

## Highlights

- Interactive dashboard workspace with draggable and resizable widgets
- Four chart types: line, bar, column, and pie
- Widget composition layer so presentation does not depend on raw upstream payloads
- JWT auth with register, login, refresh, and authenticated profile flows
- Users CRUD with guarded routes and role-aware access
- Binance REST and websocket integration with retry and reconnect handling
- Redis-backed hot/stale cache strategy for aggregated dashboard data
- Swagger/OpenAPI and Postman assets for API review
- Backend, frontend, integration, and browser-level test coverage

## Tech Stack

### Frontend

- React 19
- TypeScript
- Tailwind CSS
- ApexCharts / `react-apexcharts`
- Axios
- Lenis

### Backend

- NestJS
- TypeScript
- Fastify adapter
- Socket.IO gateways
- JWT authentication
- Prisma ORM

### Data / Infra

- PostgreSQL
- Redis
- Binance REST API
- Binance websocket streams

## Repo Structure

```text
nanodashboard/
├─ api/                     # NestJS backend
├─ web/                     # React frontend
├─ architecture-diagrams/   # Supporting architecture assets
├─ database design/         # Database design references
├─ Runtime execution flows/ # Runtime flow references
├─ docker-compose.yml       # Local PostgreSQL + Redis
├─ README.md
└─ README.th.md
```

## Core Features

### Frontend

- Custom dashboard layout behavior for drag, resize, collision handling, and reset
- Chart widgets for BTC trend, market share, volume profile, and daily PNL
- Resizable open-orders table built to fit widget constraints
- Realtime UI updates for BTC price, BTC volume, and user events
- `getDateRange` utility for normalized UTC date-range handling

### Backend

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `GET /api/auth/me`
- `GET /api/users`, `GET /api/users/me`, `GET /api/users/:id`, `PATCH /api/users/:id`, `DELETE /api/users/:id`
- `GET /api/market/ticker/:symbol`
- `GET /api/dashboard`
- `GET /api/dashboard/summary`
- Socket.IO realtime endpoints on `/users` and `/ws`

## Quick Start

### 1. Start local infrastructure

```bash
docker-compose up -d
```

This starts:

- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`

### 2. Run the backend

```bash
cd api
npm install
```

Create `api/.env`:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/api?schema=public
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-me
JWT_REFRESH_SECRET=change-me-refresh
BINANCE_BASE_URL=https://api.binance.com
BINANCE_WS_BASE_URL=wss://stream.binance.com:9443/ws
BINANCE_LIVE_STREAM_ENABLED=true
```

Then run:

```bash
npx prisma generate
npx prisma migrate dev
npm run db:seed
npm run start:dev
```

Backend URLs:

- API base: `http://localhost:3000/api`
- Swagger UI: `http://localhost:3000/api/docs`
- OpenAPI JSON: `http://localhost:3000/api/docs-json`

### 3. Run the frontend

```bash
cd web
npm install
```

Create `web/.env.local`:

```env
VITE_API_BASE_URL=http://localhost:3000
```

Then run:

```bash
npm run dev
```

Frontend URL:

- `http://localhost:5173`

## Testing

### Backend

```bash
cd api
npm test
npm run test:e2e
```

### Frontend

```bash
cd web
npm test
npm run test:e2e
```

## Reliability Notes

- Dashboard aggregation uses hot cache and stale cache to reduce repeated upstream calls
- Binance REST requests retry only for retryable failure classes
- Dashboard sections are wrapped with timeout and fallback behavior
- Successful rebuilds repopulate both hot and stale cache layers
- BTC live consumers reconnect with exponential backoff
- Frontend socket handling also reconnects and cleans up listeners to avoid duplication

## Trade-offs And Known Limitations

- Open orders and daily PNL still include demo-oriented seeded data
- Expandable table rows are not implemented yet
- Observability is intentionally light; metrics, tracing, and alerting are not complete
- CORS origins are still configured in code instead of fully externalized
- The project is production-like in structure, but not presented as a production trading platform

## Additional Documentation

- Backend docs: [api/README.md](./api/README.md)
- Thai project overview: [README.th.md](./README.th.md)
- Postman collection: [api/postman/NanoDashboard.postman_collection.json](./api/postman/NanoDashboard.postman_collection.json)
