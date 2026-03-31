# nanodashboard — API

A production-style NestJS backend for a crypto dashboard. Provides JWT authentication, role-based user management, live Binance market data with a hot/stale Redis cache fallback, a dashboard health summary, and a standardized success/error response envelope across all endpoints.

At runtime, ticker requests are served through Binance + Redis caching. The Prisma market-data models and seed data exist in the schema, but they are not part of the live ticker request path in the current implementation.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 11 (Fastify adapter) |
| ORM | Prisma 7 |
| Database | PostgreSQL |
| Cache | Redis (ioredis) |
| Auth | JWT / Passport (passport-jwt) |
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
| `JWT_SECRET` | `change-me` | Secret used to sign and verify JWT tokens |
| `BINANCE_BASE_URL` | `https://api.binance.com` | Base URL for the Binance REST API |

---

## Installation

```bash
npm install
```

---

## Database Setup

Run migrations and (optionally) seed the database:

```bash
npx prisma migrate deploy
npm run db:seed
```

---

## Running the App

```bash
# development (watch mode)
npm run start:dev

# production
npm run build
npm run start:prod
```

The server starts at `http://localhost:PORT` with a global `/api` prefix.

---

## Running Tests

```bash
# unit tests
npm test

# unit tests with coverage
npm run test:cov

# end-to-end tests
npm run test:e2e
```

---

## API Endpoints

All routes are prefixed with `/api`.

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | — | Register a new user |
| `POST` | `/api/auth/login` | — | Login and receive a JWT |
| `GET` | `/api/auth/me` | JWT | Return the authenticated user |

### Users

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/users` | JWT + Admin | Paginated user list; supports `page`, `limit`, `search` |
| `GET` | `/api/users/me` | JWT | Return the authenticated user's profile |
| `GET` | `/api/users/:id` | JWT + Admin | Get user by UUID |
| `PATCH` | `/api/users/:id` | JWT + Admin | Update user fields |
| `DELETE` | `/api/users/:id` | JWT + Admin | Soft-delete a user |

### Market Data

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/market/ticker/:symbol` | JWT | Get ticker data for a symbol (e.g. `BTCUSDT`) |

### Dashboard

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/dashboard/summary` | JWT | System health summary with `topMovers` (fixed tracked-symbol list for dashboard display) and user count |

### WebSocket Events

The system emits real-time events via WebSocket:

- `user.created`
- `user.updated`

These events are emitted only after successful database mutations and are covered by integration tests.

---

## High-Level Flow

```
Client
  │
  ├─ POST /api/auth/login
  │     └─ AuthService validates credentials → issues JWT
  │
  ├─ GET /api/market/ticker/:symbol   [Bearer token required]
  │     ├─ Check Redis hot cache  →  hit: return (cacheSource: "hot")
  │     ├─ Fetch from Binance     →  ok: persist to Redis cache, return (cacheSource: "fresh")
  │     └─ Binance down           →  stale cache hit: return (cacheSource: "stale") | 503
  │
  └─ GET /api/dashboard/summary
        ├─ Health-check DB (SELECT 1) + Redis (PING)
        ├─ Count active users
        └─ Aggregate tracked symbols from cached ticker data
```

Users are never hard-deleted. The `deletedAt` timestamp marks soft-deleted records, which are excluded from all reads. Admin-only endpoints are enforced by `RolesGuard` after JWT verification.

Note: `CryptoPrice` and `PriceHistory` exist in the Prisma schema and seed script, but the current runtime market-data flow does not read from or write to those tables.

---

## Response Shapes

### Success

```json
{
  "success": true,
  "message": "OK",
  "data": { },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

`meta` is only present on paginated responses.

### Error

```json
{
  "success": false,
  "statusCode": 401,
  "message": "Unauthorized",
  "timestamp": "2026-03-30T12:00:00.000Z",
  "path": "/api/users"
}
```

`message` may be a string or an array of validation error strings (e.g. from a `400 Bad Request`).

### Ticker Response (`data` field)

```json
{
  "symbol": "BTCUSDT",
  "price": "67420.00000000",
  "volume24h": "18340.52000000",
  "priceChange24h": "1.45",
  "high24h": "68100.00000000",
  "low24h": "66200.00000000",
  "fetchedAt": "2026-03-30T11:58:00.000Z",
  "cacheSource": "hot"
}
```

`cacheSource` is one of `"fresh"`, `"hot"`, or `"stale"`.

### Dashboard Summary Response (`data` field)

```json
{
  "userCount": 12,
  "topMovers": [],
  "health": {
    "db": "up",
    "redis": "up",
    "wsConnections": null
  },
  "warnings": [],
  "generatedAt": "2026-03-30T12:00:00.000Z"
}
```
