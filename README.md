# NanoDashboard

NanoDashboard is a trading-style fullstack dashboard built as a take-home assignment for a Mid-Senior Fullstack Developer role. It combines a React frontend focused on interactive dashboard behavior with a NestJS backend that owns authentication, market-data integration, caching, realtime delivery, and dashboard aggregation.

The goal was not to ship a collection of isolated demo screens and endpoints, but a small product slice that is still reviewable from an architecture perspective. The frontend behaves like a workspace with draggable and resizable widgets, while the backend exposes a dashboard-specific contract instead of leaking external Binance payloads directly to the client.

## Live Demo

- Frontend: `https://nano-dashboard-pi.vercel.app/`
- Backend: `https://dynamic-embrace-production.up.railway.app`
- Swagger UI: `https://dynamic-embrace-production.up.railway.app/api/docs`
- OpenAPI JSON: `https://dynamic-embrace-production.up.railway.app/api/docs-json`
- Thai documentation: [README.th.md](/c:/Users/User/Desktop/nanodashboard/README.th.md)

## Highlights

- Interactive dashboard workspace with drag, resize, reset, minimize/maximize, and widget composition
- Multiple chart types via ApexCharts: line, bar, column, and pie
- Realtime frontend updates for BTC price, BTC volume, and user events
- NestJS backend with JWT auth, refresh token flow, user CRUD, and role-based protection
- Binance REST and websocket integration with retry, reconnect, timeout, and fallback behavior
- Redis-backed hot/stale cache strategy for aggregated dashboard responses
- Swagger/OpenAPI docs and a Postman collection for API review
- Automated coverage across backend, frontend, and browser-level flows

## Architecture At A Glance

This project uses a modular monolith. That keeps the codebase structured enough to demonstrate clear service boundaries without introducing the operational overhead of microservices for a take-home assignment.

Main backend modules include:

- `auth`
- `users`
- `dashboard`
- `market-data`
- `binance`
- `events`
- `orders`
- `pnl`
- `internal`

The main frontend responsibility is rendering and interaction. The backend absorbs external API complexity, normalizes market data, applies cache/fallback behavior, and exposes dashboard-shaped responses to the UI.

## Repo Structure

```text
nanodashboard/
├─ api/                    # NestJS backend
├─ web/                    # React frontend
├─ architecture-diagrams/  # Supporting architecture assets
├─ database design/        # Database design references
├─ Runtime execution flows/# Runtime flow references
├─ docker-compose.yml      # Local PostgreSQL + Redis
├─ README.md
└─ README.th.md
```

## Assignment Coverage

### Frontend

- Drag / resize / arrange widgets: done
- Four chart types: done
- Realtime UI updates: done
- `getDateRange` utility: done
- Resizable table columns: done
- Expandable table rows: not implemented yet

### Backend

- Users CRUD + JWT auth: done
- Refresh token flow: done
- User websocket events: done
- Binance REST + websocket integration: done
- Redis cache: done
- Aggregated dashboard endpoint: done
- Internal service layer: done
- Database schema design: done

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

### Testing

- Jest
- Vitest + Testing Library
- Playwright

## Quick Start

### 1. Start infrastructure

```bash
docker-compose up -d
```

This starts:

- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`

### 2. Start the backend

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

### 3. Start the frontend

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

## Key API Surface

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/me`

### Users

- `GET /api/users`
- `GET /api/users/me`
- `GET /api/users/:id`
- `PATCH /api/users/:id`
- `DELETE /api/users/:id`

### Market Data

- `GET /api/market/ticker/:symbol`

### Dashboard

- `GET /api/dashboard`
- `GET /api/dashboard/summary`

### Realtime

- Socket.IO namespace: `/users`
- Socket.IO namespace: `/ws`
- Example events: `user.created`, `user.updated`, `btc.price.updated`, `btc.volume.updated`

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

- Dashboard aggregation uses hot cache and stale cache to reduce repeated upstream calls and preserve degraded usability
- Binance REST requests use retry logic for retryable failure modes
- Dashboard sections are protected by timeout and fallback behavior
- Binance live consumers reconnect with exponential backoff
- Frontend websocket handling also reconnects with cleanup to avoid duplicate listeners

## Trade-offs And Known Limitations

- Open orders and daily PNL still include demo-oriented seeded data
- Expandable table rows are not implemented yet
- Production observability is still limited; metrics, tracing, and alerting are not fully built out
- CORS origins are still defined in code rather than fully externalized to environment config
- The system is production-like in structure, but not presented as a complete production trading platform

## Additional Docs

- Backend-focused documentation: [api/README.md](/c:/Users/User/Desktop/nanodashboard/api/README.md)
- Thai project overview: [README.th.md](/c:/Users/User/Desktop/nanodashboard/README.th.md)
- Postman collection: [api/postman/NanoDashboard.postman_collection.json](/c:/Users/User/Desktop/nanodashboard/api/postman/NanoDashboard.postman_collection.json)
