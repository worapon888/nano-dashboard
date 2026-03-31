# NanoDashboard API

## Project Overview

A NestJS backend for a real-time crypto dashboard exercise. The system provides JWT authentication with role-based access control, a full user management API with soft deletes, live market data from Binance with a multi-tier Redis cache, a WebSocket gateway that broadcasts domain events to connected clients, and a dashboard health summary under a consistent success/error response envelope.

---

## Why This Stack

| Concern | Choice | Reason |
|---|---|---|
| Framework | NestJS 11 | Strong module system, DI container, built-in guards/filters/pipes — exactly the boundaries needed before moving to microservices |
| HTTP Adapter | Fastify | Higher throughput than Express with identical NestJS API surface |
| ORM | Prisma 7 | Type-safe queries, readable schema-first migrations, no boilerplate |
| Database | PostgreSQL | ACID compliance, native UUID support, `TIMESTAMPTZ` columns |
| Cache | Redis (ioredis) | Sub-millisecond reads, pub/sub for the ticker lock pattern, `SET NX` for distributed locks |
| Auth | JWT + Passport | Stateless, scales horizontally without shared session storage |
| WebSocket | `@nestjs/platform-ws` | Lightweight native WS adapter; no socket.io overhead for a broadcast-only use case |
| Tests | Jest + Supertest + `ws` clients | Fast unit tests plus HTTP/WebSocket integration coverage without a live database |

### Modular Monolith vs Microservices

The codebase starts as a **modular monolith**: one deployable unit, but with hard module boundaries (`AuthModule`, `UsersModule`, `MarketDataModule`, `DashboardModule`, `EventsModule`). This gives:

- Fast iteration and simple local setup (one process, one DB, one Redis)
- Clear ownership boundaries that map 1:1 to future microservices
- No network latency between domain calls during development

The boundaries that matter for a future extraction:
- `BinanceService` is already isolated behind `BinanceModule` — it can become a market-data microservice without touching other modules
- `EventsModule` (WebSocket gateway) can be extracted to a dedicated notifications service once fan-out volume demands it
- `InternalService` already abstracts health probes so each extracted service can own its own health endpoint

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 11 (Fastify adapter) |
| ORM | Prisma 7 |
| Database | PostgreSQL |
| Cache | Redis (ioredis) |
| Auth | JWT / Passport (passport-jwt) |
| WebSocket | @nestjs/websockets + @nestjs/platform-ws |
| HTTP Client | @nestjs/axios |
| Testing | Jest / Supertest |

---

## Requirements

- Node.js
- npm
- PostgreSQL
- Redis

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values.

| Variable | Example | Description |
|---|---|---|
| `PORT` | `3000` | Port the server listens on |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/api?schema=public` | Prisma PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | ioredis connection string |
| `JWT_SECRET` | `change-me` | Secret used to sign and verify JWT tokens — use a strong random value in production |
| `BINANCE_BASE_URL` | `https://api.binance.com` | Base URL for the Binance REST API — required at startup |

---

## Installation

```bash
npm install
```

---

## Database Setup

```bash
# apply migrations
npx prisma migrate deploy

# (optional) seed initial data
npm run db:seed
```

---

## Running the App

```bash
# development — watch mode
npm run start:dev

# production
npm run build
npm run start:prod
```

All HTTP routes are served under the `/api` global prefix.
The WebSocket gateway listens on the same port at path `/ws`.

---

## Running Tests

```bash
# unit tests (market-data cache/lock logic)
npm test

# unit tests with coverage report
npm run test:cov

# end-to-end tests (auth, users CRUD, dashboard, market ticker, websocket events)
npm run test:e2e
```

---

## API Overview

### Auth — no token required

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create a new account |
| `POST` | `/api/auth/login` | Authenticate and receive a JWT |
| `GET` | `/api/auth/me` | Return the token's owner (JWT required) |

### Users — JWT required; `*` = Admin only

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/users` `*` | Paginated list; query params: `page`, `limit`, `search` |
| `GET` | `/api/users/me` | Authenticated user's own profile |
| `GET` | `/api/users/:id` `*` | User detail by UUID |
| `PATCH` | `/api/users/:id` `*` | Update `displayName`, `role`, or `isActive` |
| `DELETE` | `/api/users/:id` `*` | Soft-delete (sets `deletedAt`, excludes from all reads) |

### Market Data — JWT required

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/market/ticker/:symbol` | Ticker for a symbol (e.g. `BTCUSDT`) |

### Dashboard — JWT required

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/dashboard/summary` | Health status, tracked market symbols (`topMovers` field), and active user count |

### WebSocket Events

The system provides real-time updates via WebSocket for key domain events:

- `user.created`
- `user.updated`

Events are emitted strictly after successful database mutations to ensure consistency between state and realtime signals.

WebSocket delivery is covered by integration tests, verifying:
- fan-out to multiple connected clients
- exactly-once emission per mutation
- payload safety (no sensitive fields)
- event delivery is non-blocking and does not affect HTTP response latency

Connect: `ws://localhost:PORT/ws`

All events share the envelope `{ "event": string, "data": object }`.

| Event | Trigger |
|---|---|
| `user.created` | After a successful `POST /api/auth/register` |
| `user.updated` | After a successful `PATCH /api/users/:id` |
| `ticker:<SYMBOL>` | After a fresh Binance fetch is written to cache (e.g. `ticker:BTCUSDT`) |

Because this uses the native WS protocol (not socket.io), any standard WebSocket client can connect — no special library required on the consumer side.
The e2e suite now opens two real WS clients and verifies `user.created` and `user.updated` fan out exactly once per successful mutation with safe payloads.

---

## Data Flow

```
POST /api/auth/login
  └─ validate credentials → sign JWT → return token

POST /api/auth/register
  └─ hash password → persist user → broadcast user.created (WS) → return safe user

PATCH /api/users/:id  (Bearer token, Admin)
  └─ update DB → invalidate cache keys → broadcast user.updated (WS) → return user

GET /api/market/ticker/:symbol  (Bearer token)
  ├─ Redis hot cache hit    → return immediately          (cacheSource: "hot")
  ├─ Lock acquired          → fetch Binance → write hot + stale cache
  │                           → broadcast ticker:<SYMBOL> (WS)
  │                           → return                    (cacheSource: "fresh")
  ├─ Lock contested         → subscribe pub/sub channel → await fetcher result
  │                           → return                    (cacheSource: "fresh")
  └─ Binance unreachable    → Redis stale fallback        (cacheSource: "stale")
                              no stale data → 503

GET /api/dashboard/summary
  ├─ Redis hot cache hit    → return immediately
  ├─ Build:
  │   ├─ ping DB + Redis    → health status
  │   ├─ count active users (cache: app:users:active-count, TTL 60 s)
  │   └─ read cached dashboard symbols for the default tracked symbol list
  └─ Binance/DB unavailable → Redis stale dashboard fallback or 503
```

---

## Architecture Notes

- **Fastify adapter** — configured once in `main.ts`; all modules remain adapter-agnostic.
- **Global `ValidationPipe`** — `whitelist: true` + `forbidNonWhitelisted: true` strips and rejects unknown fields at every boundary.
- **Role-based access** — `JwtAuthGuard` (Passport JWT strategy) verifies the token; `RolesGuard` reads the `role` claim from the payload. Guards are applied per-route, not globally.
- **Soft deletes** — `deletedAt` timestamp on the `users` table; all queries filter `deletedAt: null`. Hard delete is intentionally absent.
- **Three-tier ticker cache** — hot TTL 10 s → stale TTL 120 s → `BinanceUnavailableException`. A distributed `SET NX` lock prevents thundering-herd re-fetches; waiting requests subscribe to a Redis pub/sub channel instead of polling.
- **Events abstractions** — `EventsModule` is `@Global()` and exports small publisher/provider contracts (`USER_EVENTS_PUBLISHER`, `MARKET_EVENTS_PUBLISHER`, `WS_CONNECTIONS_PROVIDER`) so services depend on application-level event publishing rather than the gateway class directly.
- **Standardized envelope** — `successResponse()` wraps all success paths; `HttpExceptionFilter` wraps all errors. The contract is stable across every route.

---

## Caching Strategy

| Key pattern | TTL | Purpose |
|---|---|---|
| `app:ticker:<SYMBOL>:hot` | 10 s | Primary ticker cache; serves most requests |
| `app:ticker:<SYMBOL>:stale` | 120 s | Fallback when Binance is unreachable |
| `app:lock:ticker:<SYMBOL>` | 5 s | Distributed lock — one fetcher at a time |
| `app:ch:ticker:<SYMBOL>` | — | Redis pub/sub channel — waiters subscribe here |
| `app:users:active-count` | 60 s | Count of non-deleted, active users for the dashboard |
| `app:dashboard:summary` | 30 s | Hot dashboard cache |
| `app:dashboard:summary:stale` | 300 s | Stale dashboard fallback |

Cache invalidation on mutation:
- `PATCH /api/users/:id` and `DELETE /api/users/:id` → del `app:users:active-count`, `app:dashboard:summary`

---

## Problems Encountered & Solutions

| Problem | Solution |
|---|---|
| Thundering herd on cold ticker cache | Distributed `SET NX` lock + Redis pub/sub. One request fetches; all others subscribe and await the publish instead of racing to Binance. |
| Binance rate-limit / transient failures | Exponential backoff with jitter (4 attempts, base 200 ms). Non-retryable codes (400, 403, 418) exit immediately. |
| Stale data during Binance outage | Two-tier cache (hot + stale). The stale key has a longer TTL and is updated on every successful fetch. |
| Dashboard latency under partial failure | `Promise.allSettled` for user count + tracked dashboard symbols + health. Any individual failure produces a warning in the response without blocking the others. |
| WebSocket token availability across modules | `EventsModule` is `@Global()` and provides three named tokens. All consumers use `@Optional()` so the app boots and tests run correctly when the gateway is absent. |
| Dashboard market panel overstating “top movers” | The dashboard still returns the legacy `topMovers` field for compatibility, but the service now treats it honestly as a tracked-symbol snapshot from cache rather than a true ranked market-movers query. |

---

## Response Shape

```json
{
  "success": true,
  "message": "OK",
  "data": {}
}
```

Paginated responses include a `meta` field:

```json
{
  "success": true,
  "message": "OK",
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

**Ticker `data`:**

```json
{
  "symbol": "BTCUSDT",
  "price": "67420.00000000",
  "volume24h": "18340.52000000",
  "priceChange24h": "1.45",
  "high24h": "68100.00000000",
  "low24h": "66200.00000000",
  "fetchedAt": "2026-03-30T11:58:00.000Z",
  "source": "binance",
  "cacheSource": "hot"
}
```

`cacheSource` is one of `"fresh"`, `"hot"`, or `"stale"`. A `"stale"` response also includes `"stale": true`.

**Dashboard `data`:**

```json
{
  "userCount": 12,
  "topMovers": [], // fixed tracked-symbol snapshot for dashboard display, not exchange-ranked movers
  "health": { "db": "up", "redis": "up", "wsConnections": 2 },
  "warnings": [],
  "generatedAt": "2026-03-30T12:00:00.000Z"
}
```

`topMovers` is a legacy response field name. In the current implementation it is a fixed tracked-symbol snapshot for dashboard display, not exchange-ranked movers. It is empty until ticker data has been fetched and cached for at least one symbol.

## Test Coverage Notes

- `npm test` covers the market-data cache/lock flow with unit tests.
- The system is designed to be testable without relying on external Binance availability by isolating the `BinanceService` and mocking HTTP responses in unit tests.
- `npm run test:e2e` covers auth, users CRUD, dashboard summary, ticker HTTP behavior, and WebSocket fan-out for `user.created` and `user.updated`.
- The suite verifies that two real WS clients can connect and receive exactly one safe event per successful mutation.
- Ticker WebSocket fan-out is implemented, but it is not covered by a dedicated WebSocket integration test yet.

---

## Error Shape

```json
{
  "success": false,
  "statusCode": 401,
  "message": "Unauthorized",
  "timestamp": "2026-03-30T12:00:00.000Z",
  "path": "/api/users"
}
```

`message` is a string for most errors and an array of strings for validation failures (`400 Bad Request`).
