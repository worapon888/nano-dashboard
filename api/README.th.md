# NanoDashboard API

## ภาพรวมโปรเจกต์

Backend ที่พัฒนาด้วย NestJS สำหรับโจทย์ระบบ crypto dashboard แบบ real-time โดยระบบรองรับ JWT authentication พร้อม role-based access control, API สำหรับจัดการผู้ใช้แบบครบถ้วนพร้อม soft delete, ข้อมูลตลาดแบบ live จาก Binance พร้อม Redis cache หลายชั้น, WebSocket gateway สำหรับ broadcast domain events ไปยัง client ที่เชื่อมต่ออยู่, และ dashboard health summary ภายใต้ success/error response envelope ที่มีรูปแบบสม่ำเสมอ

---

## เหตุผลในการเลือก Stack นี้

| Concern | Choice | Reason |
|---|---|---|
| Framework | NestJS 11 | มี module system และ DI container ที่ชัดเจน พร้อม guards/filters/pipes ในตัว ซึ่งเหมาะกับการวาง boundary ก่อนขยับไปสู่ microservices |
| HTTP Adapter | Fastify | ให้ throughput สูงกว่า Express โดยยังใช้ NestJS API surface เดิมได้เหมือนกัน |
| ORM | Prisma 7 | query แบบ type-safe, migration ในรูปแบบ schema-first ที่อ่านง่าย, และลด boilerplate |
| Database | PostgreSQL | รองรับ ACID, มี UUID โดยตรง, และรองรับคอลัมน์ `TIMESTAMPTZ` |
| Cache | Redis (ioredis) | อ่านข้อมูลได้เร็วระดับ sub-millisecond, รองรับ pub/sub สำหรับ ticker lock pattern, และใช้ `SET NX` ทำ distributed lock |
| Auth | JWT + Passport | เป็น stateless auth ที่ scale แบบ horizontal ได้โดยไม่ต้องพึ่ง shared session storage |
| WebSocket | `@nestjs/platform-ws` | เป็น native WS adapter ที่เบา เหมาะกับ use case แบบ broadcast-only โดยไม่ต้องมี socket.io overhead |
| Tests | Jest + Supertest + `ws` clients | รองรับทั้ง unit tests ที่รันเร็ว และ HTTP/WebSocket integration coverage โดยไม่ต้องใช้ฐานข้อมูลจริง |

### Modular Monolith vs Microservices

โค้ดเบสนี้เริ่มต้นในรูปแบบ **modular monolith**: deploy เป็นหน่วยเดียว แต่แยก boundary ของแต่ละ module ชัดเจน (`AuthModule`, `UsersModule`, `MarketDataModule`, `DashboardModule`, `EventsModule`) ซึ่งให้ข้อดีดังนี้:

- พัฒนาได้เร็ว และ setup บนเครื่องง่าย (หนึ่ง process, หนึ่ง DB, หนึ่ง Redis)
- แบ่งขอบเขตความรับผิดชอบชัดเจน และ map ไปเป็น microservices ได้แบบ 1:1 ในอนาคต
- ระหว่างพัฒนาไม่มี network latency แทรกระหว่าง domain calls

boundary ที่สำคัญสำหรับการแยก service ในอนาคต:
- `BinanceService` ถูกแยกไว้หลัง `BinanceModule` อยู่แล้ว จึงย้ายออกเป็น market-data microservice ได้โดยไม่กระทบ module อื่น
- `EventsModule` (WebSocket gateway) สามารถแยกออกเป็น notifications service โดยเฉพาะได้ เมื่อปริมาณ fan-out สูงขึ้น
- `InternalService` แยก abstraction ของ health probes ไว้แล้ว ทำให้แต่ละ service ที่ถูกแยกออกไปสามารถดูแล health endpoint ของตัวเองได้

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

## สิ่งที่ต้องมี

- Node.js
- npm
- PostgreSQL
- Redis

---

## Environment Variables

คัดลอก `.env.example` เป็น `.env` แล้วกรอกค่าที่จำเป็นให้ครบ

| Variable | Example | Description |
|---|---|---|
| `PORT` | `3000` | พอร์ตที่ server ใช้รับคำขอ |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/api?schema=public` | Prisma PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | ioredis connection string |
| `JWT_SECRET` | `change-me` | secret สำหรับ sign และ verify JWT ควรใช้ค่าแบบสุ่มที่แข็งแรงใน production |
| `BINANCE_BASE_URL` | `https://api.binance.com` | Base URL ของ Binance REST API และระบบจะต้องมีค่านี้ตั้งแต่เริ่มต้น |

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

HTTP routes ทั้งหมดจะถูกเสิร์ฟภายใต้ global prefix `/api`
ส่วน WebSocket gateway จะฟังที่พอร์ตเดียวกันบน path `/ws`

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

### Auth — ไม่ต้องใช้ token

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | สร้างบัญชีผู้ใช้ใหม่ |
| `POST` | `/api/auth/login` | ยืนยันตัวตนและรับ JWT |
| `GET` | `/api/auth/me` | คืนข้อมูลเจ้าของ token นี้ (ต้องใช้ JWT) |

### Users — ต้องใช้ JWT; `*` = Admin เท่านั้น

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/users` `*` | รายการแบบแบ่งหน้า; query params: `page`, `limit`, `search` |
| `GET` | `/api/users/me` | โปรไฟล์ของผู้ใช้ที่ล็อกอินอยู่ |
| `GET` | `/api/users/:id` `*` | รายละเอียดผู้ใช้ตาม UUID |
| `PATCH` | `/api/users/:id` `*` | อัปเดต `displayName`, `role` หรือ `isActive` |
| `DELETE` | `/api/users/:id` `*` | soft-delete (ตั้งค่า `deletedAt` และตัดออกจากการอ่านทั้งหมด) |

### Market Data — ต้องใช้ JWT

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/market/ticker/:symbol` | ข้อมูล ticker ของ symbol ที่ระบุ (เช่น `BTCUSDT`) |

### Dashboard — ต้องใช้ JWT

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/dashboard/summary` | สถานะ health, รายการสัญลักษณ์ตลาดที่ใช้บน dashboard (`topMovers` field) และจำนวน active users |

### WebSocket Events

ระบบรองรับ real-time updates ผ่าน WebSocket สำหรับ key domain events ดังนี้:

- `user.created`
- `user.updated`

events จะถูก emit หลังจาก database mutation สำเร็จแล้วเท่านั้น เพื่อให้สถานะข้อมูลและสัญญาณ real-time สอดคล้องกัน

การส่ง WebSocket ถูกครอบคลุมด้วย integration tests โดยตรวจสอบว่า:
- fan-out ไปยัง client หลายตัวที่เชื่อมต่ออยู่ได้
- emit เพียงครั้งเดียวต่อ mutation ที่สำเร็จหนึ่งครั้ง
- payload ปลอดภัยและไม่มี sensitive fields
- event delivery เป็นแบบ non-blocking และไม่กระทบต่อ HTTP response latency

Connect: `ws://localhost:PORT/ws`

ทุก event ใช้ envelope รูปแบบเดียวกันคือ `{ "event": string, "data": object }`

| Event | Trigger |
|---|---|
| `user.created` | หลัง `POST /api/auth/register` สำเร็จ |
| `user.updated` | หลัง `PATCH /api/users/:id` สำเร็จ |
| `ticker:<SYMBOL>` | หลังดึงข้อมูลใหม่จาก Binance แล้วเขียนลง cache สำเร็จ (เช่น `ticker:BTCUSDT`) |

เนื่องจากระบบนี้ใช้ native WS protocol (ไม่ใช่ socket.io) client WebSocket มาตรฐานใดก็สามารถเชื่อมต่อได้ โดยไม่ต้องใช้ library เฉพาะ
e2e suite จะเปิด WS client จริงสองตัว และตรวจสอบว่า `user.created` และ `user.updated` ถูก fan out อย่างถูกต้องเพียงครั้งเดียวต่อ successful mutation พร้อม payload ที่ปลอดภัย

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

- **Fastify adapter** — ตั้งค่าครั้งเดียวใน `main.ts`; modules อื่นทั้งหมดจึงไม่ผูกกับ adapter ใดโดยตรง
- **Global `ValidationPipe`** — `whitelist: true` + `forbidNonWhitelisted: true` ใช้สำหรับ strip และ reject fields ที่ไม่ได้รับอนุญาตในทุก boundary
- **Role-based access** — `JwtAuthGuard` (Passport JWT strategy) ใช้ตรวจสอบ token; `RolesGuard` อ่าน `role` claim จาก payload โดย guards ถูกผูกเป็นราย route ไม่ได้เปิดใช้แบบ global
- **Soft deletes** — ใช้ `deletedAt` timestamp บนตาราง `users`; ทุก query จะกรองด้วย `deletedAt: null` และตั้งใจไม่รองรับ hard delete
- **Three-tier ticker cache** — hot TTL 10 s → stale TTL 120 s → `BinanceUnavailableException` โดยใช้ distributed `SET NX` lock เพื่อกันปัญหา thundering herd re-fetches และ request ที่รอจะ subscribe ผ่าน Redis pub/sub channel แทนการ polling
- **Events abstractions** — `EventsModule` เป็น `@Global()` และ export publisher/provider contracts ขนาดเล็ก (`USER_EVENTS_PUBLISHER`, `MARKET_EVENTS_PUBLISHER`, `WS_CONNECTIONS_PROVIDER`) เพื่อให้ service ต่าง ๆ พึ่งพา abstraction ระดับ application event publishing แทนการอ้างถึง gateway class โดยตรง
- **Standardized envelope** — `successResponse()` ใช้ครอบทุก success path; `HttpExceptionFilter` ใช้ครอบทุก error ทำให้ contract มีรูปแบบคงที่ในทุก route

---

## Caching Strategy

| Key pattern | TTL | Purpose |
|---|---|---|
| `app:ticker:<SYMBOL>:hot` | 10 s | ticker cache หลักที่รองรับคำขอส่วนใหญ่ |
| `app:ticker:<SYMBOL>:stale` | 120 s | fallback เมื่อ Binance ใช้งานไม่ได้ |
| `app:lock:ticker:<SYMBOL>` | 5 s | distributed lock — ให้มีผู้ fetch ได้ครั้งละหนึ่งคำขอ |
| `app:ch:ticker:<SYMBOL>` | — | Redis pub/sub channel — สำหรับ request ที่รอ subscribe |
| `app:users:active-count` | 60 s | จำนวนผู้ใช้ที่ active และไม่ถูกลบ สำหรับใช้บน dashboard |
| `app:dashboard:summary` | 30 s | dashboard cache ชั้น hot |
| `app:dashboard:summary:stale` | 300 s | stale fallback ของ dashboard |

การ invalidate cache เมื่อมี mutation:
- `PATCH /api/users/:id` และ `DELETE /api/users/:id` → del `app:users:active-count`, `app:dashboard:summary`

---

## Problems Encountered & Solutions

| Problem | Solution |
|---|---|
| Thundering herd on cold ticker cache | ใช้ distributed `SET NX` lock + Redis pub/sub โดยให้มี request เดียวเป็นผู้ fetch และ request อื่น subscribe รอผล publish แทนการแย่งยิงไปที่ Binance |
| Binance rate-limit / transient failures | ใช้ exponential backoff พร้อม jitter (4 attempts, base 200 ms) และกรณีที่ retry ไม่ควรเกิด เช่น 400, 403, 418 จะจบทันที |
| Stale data during Binance outage | ใช้ cache สองชั้น (hot + stale) โดย stale key มี TTL นานกว่า และจะถูกอัปเดตทุกครั้งที่ fetch สำเร็จ |
| Dashboard latency under partial failure | ใช้ `Promise.allSettled` กับ user count + tracked dashboard symbols + health ทำให้หากส่วนใดล้มเหลวจะคืน warning ใน response โดยไม่บล็อกส่วนอื่น |
| WebSocket token availability across modules | `EventsModule` เป็น `@Global()` และให้ named tokens ทั้งสามตัว โดย consumer ทั้งหมดใช้ `@Optional()` เพื่อให้ระบบยัง boot และรัน tests ได้ แม้ไม่มี gateway |
| Dashboard market panel overstating “top movers” | dashboard ยังคงใช้ชื่อ field เดิมคือ `topMovers` เพื่อความเข้ากันได้ย้อนหลัง แต่ในการทำงานจริง service จะมอง field นี้เป็น tracked-symbol snapshot จาก cache ไม่ใช่ผลจัดอันดับ market movers จริงจาก exchange |

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

`cacheSource` เป็นหนึ่งใน `"fresh"`, `"hot"` หรือ `"stale"` และ response ที่เป็น `"stale"` จะมี `"stale": true` เพิ่มเข้ามาด้วย

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

`topMovers` เป็นชื่อ field เดิมที่คงไว้เพื่อความเข้ากันได้ย้อนหลัง โดยใน implementation ปัจจุบัน field นี้หมายถึง snapshot ของ tracked symbols แบบคงที่สำหรับแสดงผลบน dashboard ไม่ใช่ข้อมูล market movers ที่ exchange จัดอันดับแบบเรียลไทม์ และจะเป็นค่าว่างจนกว่าจะมีการ fetch และ cache ticker data อย่างน้อยหนึ่ง symbol

## Test Coverage Notes

- `npm test` ครอบคลุม market-data cache/lock flow ในระดับ unit tests
- ระบบถูกออกแบบให้ทดสอบได้โดยไม่ต้องพึ่งพา external Binance availability ผ่านการแยก `BinanceService` ออกจากส่วนอื่นอย่างชัดเจน และ mock HTTP responses ใน unit tests
- `npm run test:e2e` ครอบคลุม auth, users CRUD, dashboard summary, พฤติกรรมของ ticker HTTP และ WebSocket fan-out สำหรับ `user.created` และ `user.updated`
- test suite ตรวจสอบว่า WS client จริงสองตัวสามารถเชื่อมต่อและได้รับ safe event อย่างถูกต้องเพียงหนึ่งครั้งต่อ successful mutation
- แม้จะมีการรองรับ ticker WebSocket fan-out แล้ว แต่ยังไม่มี dedicated WebSocket integration test สำหรับส่วนนั้นโดยเฉพาะ

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

`message` โดยทั่วไปจะเป็น string และจะเป็น array ของ strings ในกรณี validation failures (`400 Bad Request`)
