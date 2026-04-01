# NanoDashboard Backend

NestJS backend for NanoDashboard. This service provides JWT authentication, user management, Redis-backed caching, Binance REST and realtime integration, websocket user events, and aggregated dashboard endpoints for the frontend.

## Deployment

- Backend URL: `https://dynamic-embrace-production.up.railway.app`
- Swagger UI: `https://dynamic-embrace-production.up.railway.app/api/docs`
- Swagger JSON: `https://dynamic-embrace-production.up.railway.app/api/docs-json`

## 1. Run The Project

### Local

1. Install dependencies

```bash
cd api
npm install
```

2. Start infrastructure

```bash
cd ..
docker-compose up -d
```

3. Copy environment file

```bash
cd api
cp .env.example .env
```

4. Generate Prisma client and run migrations

```bash
npx prisma generate
npx prisma migrate dev
```

5. Seed demo data

```bash
npm run db:seed
```

6. Start the backend

```bash
npm run start:dev
```

Backend default URL:

- `http://localhost:3000/api`

Swagger:

- `http://localhost:3000/api/docs`
- `http://localhost:3000/api/docs-json`

### Docker Compose

This repository already includes a root-level [docker-compose.yml](../docker-compose.yml) for PostgreSQL and Redis.

Start services:

```bash
docker-compose up -d
```

Stop services:

```bash
docker-compose down
```

This compose file starts:

- PostgreSQL 16 on `localhost:5432`
- Redis 7 on `localhost:6379`

The NestJS API itself still runs with:

```bash
cd api
npm run start:dev
```

## 2. Environment Variables

Current example file: [.env.example](./.env.example)

Required variables:

| Variable                      | Example                                                           | Purpose                                   |
| ----------------------------- | ----------------------------------------------------------------- | ----------------------------------------- |
| `PORT`                        | `3000`                                                            | HTTP port for NestJS                      |
| `DATABASE_URL`                | `postgresql://postgres:postgres@localhost:5432/api?schema=public` | PostgreSQL connection for Prisma          |
| `REDIS_URL`                   | `redis://localhost:6379`                                          | Redis connection string                   |
| `JWT_SECRET`                  | `change-me`                                                       | Access token signing secret               |
| `JWT_REFRESH_SECRET`          | `change-me-refresh`                                               | Refresh token signing secret              |
| `BINANCE_BASE_URL`            | `https://api.binance.com`                                         | Binance REST base URL                     |
| `BINANCE_WS_BASE_URL`         | `wss://stream.binance.com:9443/ws`                                | Binance websocket base URL                |
| `BINANCE_LIVE_STREAM_ENABLED` | `true`                                                            | Optional toggle for live stream consumers |

Example `.env`:

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

## 3. Tech Stack Decision

### Why NestJS

This project uses NestJS because the assignment needs more than plain CRUD:

- JWT auth and guards
- websocket gateway support
- background jobs
- service/module separation
- DTO validation
- Swagger/OpenAPI

NestJS gives those concerns in one opinionated structure, which is useful for a production-style take-home assignment.

### NestJS vs Express

NestJS advantages:

- Built-in module architecture
- First-class guards, interceptors, filters, and DI
- Better long-term maintainability for larger teams
- Easier to keep controllers thin and services isolated

Express advantages:

- Smaller surface area
- Faster to bootstrap for very small apps
- Fewer abstractions

Trade-off:

- Express is great for lightweight APIs, but this codebase benefits from NestJS because there are enough moving parts that explicit structure improves clarity.

### NestJS vs FastAPI

FastAPI advantages:

- Very fast for API-first Python services
- Great automatic docs experience
- Excellent validation with Pydantic-style patterns

NestJS advantages in this project:

- Shared TypeScript language with the frontend
- Easier event, DTO, and contract consistency across fullstack code
- Smooth integration of guards, websocket gateways, cron jobs, and modular services in one framework

Trade-off:

- FastAPI would be a strong choice for a Python-centric backend team, but NestJS is a better fit here because the project is realtime-heavy and fullstack TypeScript keeps context switching low.

## 4. Architecture Decision

### Chosen: Modular Monolith

This backend is implemented as a modular monolith with feature modules such as:

- `auth`
- `users`
- `dashboard`
- `binance`
- `market-data`
- `redis`
- `events`

Why this was chosen:

- The scope is large enough to require strong boundaries
- The scope is still small enough that microservices would add unnecessary operational overhead
- It keeps deployment simple for a take-home assignment
- It still leaves room for future extraction

### Monolith vs Microservices

Monolith advantages for this project:

- Simpler deployment
- Lower operational complexity
- Easier local development
- Easier transaction and service orchestration

Microservices advantages:

- Independent scaling
- Clearer fault isolation
- Better fit when ingestion, auth, and dashboard composition scale differently

Why monolith is better here:

- Reviewer value comes more from code quality and service boundaries than from infra complexity
- A modular monolith already demonstrates scalable thinking without forcing service discovery, queues, or cross-service auth too early

Likely first extraction candidate in the future:

- Binance / market data ingestion and caching

## 5. Database Schema

Schema source: [schema.prisma](./prisma/schema.prisma)

### Users

`User` stores application identities and access control metadata.

Main fields:

- `id`: UUID primary key
- `email`: unique email
- `passwordHash`: bcrypt-hashed password
- `displayName`: user-facing name
- `role`: `USER` or `ADMIN`
- `isActive`: active flag
- `createdAt`, `updatedAt`
- `deletedAt`: soft-delete timestamp

Why it exists:

- Supports registration, login, JWT identity, owner/admin authorization, and soft delete

### CryptoPrices

`CryptoPrice` stores the latest normalized market snapshot for a symbol.

Main fields:

- `symbol`
- `price`
- `volume24h`
- `priceChange24h`
- `high24h`
- `low24h`
- `source`
- `fetchedAt`

Why it exists:

- Acts as the latest known market state for dashboard consumption and future persistence

Related table:

- `PriceHistory` stores time-based snapshots for historical reference

Also present in the schema:

- `Order` for open orders / dashboard trading widget data

## 6. Common Problems And Solutions

### Binance WebSocket Disconnect

Problem:

- Binance websocket streams may close unexpectedly
- Some providers can return `451` or drop connections

Current handling:

- Reconnect with exponential backoff
- Log the exact websocket URL and retry count
- Fallback to cached or REST-backed data where applicable
- Do not crash the process on disconnect

Recommended mitigation:

- Keep websocket as primary
- Use polling or cached snapshot as fallback
- Allow production to disable live stream if the provider blocks Binance

### Redis Cache Stampede

Problem:

- Many requests can miss the same cache key at once and trigger repeated upstream fetches

Current handling:

- Dashboard uses short-lived hot cache and stale cache
- Redis utilities support atomic-ish coordination helpers like `setNx`
- Summary cache reduces repeated Binance and composition calls

Recommended mitigation:

- Use lock keys around expensive recomputation
- Serve stale data while one request refreshes
- Keep TTL short enough for freshness, but long enough to avoid bursty rebuilds

### JWT Token Expiry Handling

Problem:

- Access tokens expire and protected endpoints return `401`

Current handling:

- Backend validates JWT through guards
- Expired or invalid credentials return standardized error responses
- Refresh token secret is configured separately
- `POST /api/auth/refresh` rotates access and refresh tokens from a valid refresh token

Recommended mitigation:

- On frontend, call `/api/auth/refresh` before forcing logout when a session can still be renewed
- Clear invalid sessions and redirect to login on unrecoverable `401`

## 7. API Endpoints Summary

| Method   | Path                         | Auth | Description                                                    |
| -------- | ---------------------------- | ---- | -------------------------------------------------------------- |
| `POST`   | `/api/auth/register`         | No   | Register a new user                                            |
| `POST`   | `/api/auth/login`            | No   | Login and return access + refresh tokens                       |
| `POST`   | `/api/auth/refresh`          | No   | Exchange a refresh token for a new access + refresh token pair |
| `GET`    | `/api/auth/me`               | JWT  | Get authenticated user                                         |
| `GET`    | `/api/users`                 | JWT  | List users                                                     |
| `GET`    | `/api/users/me`              | JWT  | Get authenticated user through users module                    |
| `GET`    | `/api/users/:id`             | JWT  | Get user by id                                                 |
| `PATCH`  | `/api/users/:id`             | JWT  | Update user, owner or admin                                    |
| `DELETE` | `/api/users/:id`             | JWT  | Soft delete user                                               |
| `GET`    | `/api/market/ticker/:symbol` | JWT  | Get normalized ticker data                                     |
| `GET`    | `/api/dashboard`             | JWT  | Get aggregated users + cached market prices                    |
| `GET`    | `/api/dashboard/summary`     | JWT  | Get full dashboard summary                                     |

Websocket endpoints:

| Transport | Path     | Notes                           |
| --------- | -------- | ------------------------------- |
| Socket.IO | `/users` | User events gateway             |
| Socket.IO | `/ws`    | General realtime events gateway |

Key events:

- `user.created`
- `user.updated`
- `btc.price.updated`
- `btc.volume.updated`

## 8. Docker Notes

This project ships only infra containers in Docker Compose today:

- PostgreSQL
- Redis

If needed, the API can be containerized later, but for this assignment the simpler developer flow is:

- run infra with Docker
- run NestJS locally

## 9. Testing

Run backend tests:

```bash
cd api
npm test
```

Run e2e tests:

```bash
npm run test:e2e
```

Build the backend:

```bash
npm run build
```

## 10. Postman Collection

Included file:

- [NanoDashboard.postman_collection.json](./postman/NanoDashboard.postman_collection.json)

How to use:

1. Import the collection into Postman
2. Set `baseUrl`, `accessToken`, `refreshToken`, `userId`, and `symbol`
3. Call `Login` first, then reuse the bearer token for protected endpoints
4. Use `Refresh Tokens` to validate the refresh-token flow

The collection includes sample requests and example responses for:

- auth
- users
- market data
- dashboard

## 11. Notes For Reviewers

- Swagger is exposed at `/api/docs`
- OpenAPI JSON is exposed at `/api/docs-json`
- This backend intentionally keeps controllers thin and routes external API access through services
- Binance access is never called directly from controllers

## 12. Links

- Deployment URL: `https://dynamic-embrace-production.up.railway.app`
- Postman Collection: `api/postman/NanoDashboard.postman_collection.json`
- Repository: `https://github.com/worapon888/nano-dashboard`
