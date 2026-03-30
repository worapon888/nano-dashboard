# Phase 2 — Production-grade execution flows

Upgrade of existing flows to include concurrency control, cache stampede protection, distributed circuit breaker, request deduplication, and gap recovery. No architecture changes.

---

## Flow 1: Login → JWT

**Trigger:** `POST /auth/login` — body `{ email, password }`

**Steps:**

1. `ValidationPipe` validates `LoginDto`. `@IsEmail()` on email, `@IsString() @MinLength(8)` on password. Fail → 400 with field-level errors.

2. Dual rate limit check (Redis pipeline, single roundtrip):
   - Per-IP: `INCR app:rl:{ip}:login` + `EXPIRE 60`. Threshold: 10 req/60s.
   - Per-email: `INCR app:rl:email:{sha256(email)}:login` + `EXPIRE 900`. Threshold: 5 req/15min.
   Both checks use `MULTI/EXEC` to atomically increment and set TTL. Either limit exceeded → 429 with `Retry-After` header.

3. Account lockout check: `GET app:lockout:{sha256(email)}`. If key exists → 423 Locked with `retryAfter` = TTL remaining.

4. `AuthController.login()` → `AuthService.login(dto)`. Controller is zero-logic proxy.

5. `UserService.findByEmail(dto.email)` → Prisma: `SELECT id, email, password_hash, role, is_active FROM users WHERE email = $1 AND deleted_at IS NULL`. Query timeout: 3s.

6. No user OR `is_active = false` → `UnauthorizedException('Invalid credentials')`. Same message for both cases to prevent email enumeration.

7. `argon2.verify(user.passwordHash, dto.password)` wrapped in `Promise.race([verify(), timeout(2000)])`. argon2 runs in a worker thread — does not block event loop. Cost: ~250ms.

8. On success → `DEL app:fail:{sha256(email)}` to clear failure counter.

9. Generate access token: `jwt.sign({ sub: user.id, email, role, jti: nanoid(16) }, RS256_PRIVATE_KEY, { expiresIn: '15m' })`. The `jti` claim enables per-token revocation.

10. Generate refresh token: `tokenRaw = crypto.randomBytes(32).toString('hex')` → `tokenHash = sha256(tokenRaw)` → Prisma INSERT into `refresh_tokens`. Expiry: NOW() + 7 days. Stores `user_agent` and `ip_address` for session management UI.

11. Audit log (async, non-blocking): `setImmediate(() => auditService.log(...))`. Failure here never blocks the login response.

12. Return `{ accessToken, refreshToken: tokenRaw, expiresIn: 900, tokenType: 'Bearer' }` → 200.

**Cache strategy:**

| Key | Purpose | TTL |
|-----|---------|-----|
| `app:rl:{ip}:login` | IP rate limit counter | 60s |
| `app:rl:email:{hash}:login` | Per-email rate limit | 900s |
| `app:fail:{hash}` | Consecutive failure count | 900s |
| `app:lockout:{hash}` | Account lockout flag | 900s |
| `app:jwt:revoked:{jti}` | Per-token blocklist (used by auth guard) | 900s (matches access token TTL) |

Cache invalidation: failure counter is deleted on successful login (step 8). Lockout key expires naturally at TTL. Rate limit counters expire naturally. No active invalidation needed.

**Concurrency handling:** Rate limit uses `MULTI/EXEC` pipeline for atomic `INCR + EXPIRE`. No distributed lock needed — Redis atomic operations handle counter races. The `MULTI/EXEC` ensures the TTL is always set even if the increment and expire are issued by concurrent requests.

**Failure handling:**

- Invalid credentials: `INCR app:fail:{sha256(email)}`. If count reaches 5 → `SET app:lockout:{sha256(email)} 1 EX 900`. Response is always 401 — never reveals whether lockout triggered.
- PostgreSQL unreachable: No retry. Return 503 with `retryAfter: 5`.
- Redis unreachable: Rate limit fails open — login proceeds without rate protection. Availability over security during infrastructure failure. Separate alerting via InternalService.
- argon2 timeout (>2s): 500 + critical alert (CPU starvation).

**Data consistency:** Refresh token INSERT and audit log are separate operations. If refresh token write fails → 500, user retries. If audit log fails → login still succeeds, audit is eventually consistent. The refresh token's SHA-256 hash in the DB means a database leak doesn't compromise active sessions.

**Performance:** argon2 in worker threads prevents event loop blocking. Prisma connection pool (5 connections default) with PgBouncer in front for high-concurrency scenarios. Rate limiter's two Redis calls are pipelined into one roundtrip.

---

## Flow 2: Create user → DB → emit WebSocket

**Trigger:** `POST /auth/register` — body `{ email, password, displayName }`

**Steps:**

1. Validation: `@IsEmail()`, `@MinLength(8)` password, `@MaxLength(100)` displayName, `@Matches(/^[a-zA-Z0-9_\- ]+$/)` to block injection in display names.

2. Rate limit: `INCR app:rl:{ip}:register` — 3 req/hour per IP. Much tighter than login.

3. Idempotency check: client sends `X-Idempotency-Key` header (UUID). `SET app:idem:{key} 1 NX EX 3600`. If key already exists → return cached response from `GET app:idem:resp:{key}`. Prevents duplicate accounts on network retries.

4. `UserService.findByEmail(dto.email)`. If exists → 409 Conflict.

5. `argon2.hash(password, { memoryCost: 65536, timeCost: 3, parallelism: 4 })` — ~300ms, worker thread.

6. Prisma `$transaction` wraps user INSERT and audit log INSERT atomically. The `email` UNIQUE constraint catches races between concurrent registrations for the same email — the second transaction receives Prisma error `P2002` → re-thrown as 409.

7. Conditional WebSocket broadcast (debounced): check `server.in('admin:users').allSockets().size > 0`. If empty → skip. If subscribers exist → `INCR app:ws:batch:user_created` (TTL 2s). A 2-second interval scheduler reads this counter; if > 0, emits one `users:count_changed` event with the delta. Caps WS broadcast rate to 0.5 events/second regardless of registration volume.

8. Invalidate dashboard cache: `DEL app:dashboard:summary`. Lazy invalidation — next read rebuilds. The stale key is NOT deleted (serves as fallback).

9. Store idempotency response: `SET app:idem:resp:{key} {responseJSON} EX 3600`.

10. Return sanitized user DTO → 201.

**Cache strategy:**

| Key | Purpose | TTL |
|-----|---------|-----|
| `app:rl:{ip}:register` | Registration rate limit | 3600s |
| `app:idem:{key}` | Idempotency lock | 3600s |
| `app:idem:resp:{key}` | Cached idempotent response | 3600s |
| `app:ws:batch:user_created` | WS emission batch counter | 2s |

**Concurrency handling:** Two concurrent registrations for the same email: the application check (step 4) might pass both. The DB UNIQUE constraint is the true guard — exactly one INSERT succeeds, the other gets P2002. The idempotency key handles the different case: same client retrying after network timeout. `SET NX` is atomic — only the first request proceeds.

**Failure handling:** DB write failure → 500, no cleanup needed (nothing persisted). argon2 failure → 500. WS broadcast failure → silently caught, does not affect HTTP response. Idempotency key write failure → log warning, registration still succeeds (worst case: a retry creates a second entry, caught by UNIQUE constraint).

**WebSocket behavior:** Batched, not per-registration. Normal traffic: one event ~2s after registration. Bulk load (500 registrations in 10s): one event every 2s with cumulative count. Caps broadcast rate regardless of input volume.

**Data consistency:** Prisma `$transaction` ensures user + audit log are atomic. Dashboard cache is lazily invalidated — briefly stale (up to 30s of the dashboard cache TTL) before reflecting the new user count. Acceptable tradeoff for simplicity.

---

## Flow 3: Binance → fetch → cache → DB

**Trigger:** `GET /market/ticker/BTCUSDT` (authenticated)

**Steps:**

1. `JwtAuthGuard` validates Bearer token. Checks `GET app:jwt:revoked:{jti}` for per-token revocation. If revoked → 401.

2. Per-user rate limit: `INCR app:rl:user:{userId}:market` — 60 req/min per user. Prevents single-user cache-busting.

3. `CacheService.get('app:ticker:BTCUSDT')` → Redis GET.

4a. Cache hit → deserialize → return `TickerDto`. Done. ~1ms.

4b. Cache miss → singleflight lock: `SET app:lock:ticker:BTCUSDT {requestId} NX EX 5`.
   - Lock acquired → this request is the "fetcher."
   - Lock NOT acquired → this request is a "waiter" — subscribes to `app:ch:ticker:BTCUSDT` (Redis pub/sub) with 6s timeout.

5. Fetcher: `BinanceService.getTicker('BTCUSDT')` → Axios GET, timeout 5000ms.

6. `BinanceMapper.toTickerDto(raw)` → strips to `{ symbol, price, volume, priceChange24h, high24h, low24h, fetchedAt }`.

7. Redis pipeline (atomic, one roundtrip):
   - `SETEX app:ticker:BTCUSDT 2 {json}` — hot cache
   - `SETEX app:ticker:BTCUSDT:stale 120 {json}` — stale fallback
   - `DEL app:lock:ticker:BTCUSDT` — release lock
   - `PUBLISH app:ch:ticker:BTCUSDT {json}` — notify waiters

8. Waiters receive PUBLISH → deserialize → return. If timeout (6s) → fall through to stale cache (same as Flow 5 fallback).

9. Fetcher only: `WebSocketGateway.broadcastToRoom('ticker:BTCUSDT', 'ticker:update', dto)`. Waiters skip this — same data.

10. Return `TickerDto` → 200.

**Cache strategy:**

| Key | TTL | Purpose |
|-----|-----|---------|
| `app:ticker:{SYM}` | 2s | Hot cache |
| `app:ticker:{SYM}:stale` | 120s | Stale fallback |
| `app:lock:ticker:{SYM}` | 5s | Singleflight lock |
| `app:orderbook:{SYM}:{DEPTH}` | 1s | Orderbook hot cache |
| `app:orderbook:{SYM}:{DEPTH}:stale` | 60s | Orderbook stale fallback |
| `app:trades:{SYM}` | 1s | Trades hot cache |

**Concurrency handling — singleflight:** 100 concurrent cache misses for the same symbol → 1 Binance call + 99 pub/sub receives. The lock key's 5s TTL is a dead-letter timeout: if the fetcher crashes, the lock auto-expires and the next request becomes the new fetcher. The PUBLISH is the signal for waiters to complete — it carries the full serialized response, so waiters never read from cache (avoids a race where the cache write hasn't completed yet).

**What goes where:** Redis = all market data (ephemeral, cache-only). PostgreSQL = nothing in this flow. Market data never touches the relational DB.

**Performance:** Without singleflight: 100 concurrent misses = 100 Binance calls = rate limit exhaustion. With singleflight: 1 Binance call + 99 sub-millisecond pub/sub receives. The pipeline write (step 7) batches 4 Redis commands into 1 network roundtrip.

---

## Flow 4: GET /dashboard → cache → fallback

**Trigger:** `GET /dashboard/summary` (authenticated)

**Steps:**

1. `DashboardController.getSummary()` → `DashboardService.getSummary()`.

2. Two-tier cache check via Redis pipeline (one roundtrip): `GET app:dashboard:summary` (hot, TTL 30s) + `GET app:dashboard:summary:stale` (fallback, TTL 300s).

3a. Hot cache hit → return → 200. ~2ms.

3b. Hot miss → singleflight lock: `SET app:lock:dashboard:summary {id} NX EX 10`. Waiters subscribe to `app:ch:dashboard:summary`.

4. Fetcher executes `Promise.allSettled()` with three branches:

5. Branch A: `UserService.getActiveCount()` → own sub-cache `app:user:active_count` (TTL 60s). On miss → Prisma `SELECT COUNT(*)` with `statement_timeout = 2000`.

6. Branch B: `MarketDataService.getTopMovers(5)` → own sub-cache `app:tickers:top_volume` (TTL 10s). On miss → `BinanceService.getTopTickers()` with 5s timeout. Own singleflight lock: `app:lock:tickers:top_volume`.

7. Branch C: `InternalService.getQuickHealth()` → parallel: `prisma.$queryRaw('SELECT 1')` (1s timeout) + `redis.ping()` (500ms timeout) + `gateway.getConnectionCount()` (in-memory).

8. `allSettled` resolves. Rejected branches inject defaults with warnings:
   - A fails → `userCount: null, warnings: ['user_count_unavailable']`
   - B fails → `topMovers: [], warnings: ['market_data_unavailable']`
   - C fails → `health: { db: 'unknown', redis: 'unknown' }`

9. Redis pipeline write: `SETEX app:dashboard:summary 30 {json}` + `SETEX app:dashboard:summary:stale 300 {json}` + `DEL lock` + `PUBLISH`.

10. Return → 200. Worst case on full miss: ~350ms (bound by Binance in branch B).

**Cache strategy — three tiers:**

| Tier | Key | TTL | When used |
|------|-----|-----|-----------|
| L1: Sub-service | `app:user:active_count` | 60s | Avoids PG count query |
| L1: Sub-service | `app:tickers:top_volume` | 10s | Avoids Binance call |
| L2: Composed | `app:dashboard:summary` | 30s | Avoids all 3 branch calls |
| L3: Stale fallback | `app:dashboard:summary:stale` | 300s | Returned when all else fails |

**Cache invalidation:** Lazy. `DEL app:dashboard:summary` on user count change (Flow 2). Stale key is never actively deleted. L1 caches expire by TTL. No active invalidation for market data sub-caches.

**Concurrency handling:** Singleflight on the dashboard aggregation prevents 100 simultaneous requests after TTL expiry from triggering 100 aggregations. Branch B has its own singleflight (nested). The two locks are independent — dashboard lock doesn't block ticker fetches.

**Failure handling:** All branches fail → check stale cache from step 2. If stale exists → 200 with `stale: true`. If no stale → 503 with `Retry-After: 10`. Individual branch failures produce partial data with warnings — never 503 for a single branch failure.

**Performance:** ~95% of requests hit L2 (30s TTL under steady traffic). Singleflight prevents thundering herd after cache expiry. `Promise.allSettled` runs branches in parallel — response time equals the slowest branch, not the sum.

---

## Flow 5: Binance fail → retry → fallback cache

**Trigger:** `BinanceService` receives timeout, network error, HTTP 429, or HTTP 5xx.

**Steps:**

1. Error classification. Retryable: `ECONNABORTED`, `ECONNREFUSED`, `ENOTFOUND`, `ETIMEDOUT`, HTTP 429, HTTP 502/503/504. Non-retryable: HTTP 400, 403, 418 → fail immediately.

2. Attempt 2: delay = `min(100ms * 2^1, 5000ms) + random(0, 100ms)` ≈ 200ms + jitter.

3. Attempt 3: delay = `min(100ms * 2^2, 5000ms) + random(0, 100ms)` ≈ 400ms + jitter.

4. Attempt 4: delay = `min(100ms * 2^3, 5000ms) + random(0, 100ms)` ≈ 800ms + jitter.

5. All 4 attempts exhausted.

**Circuit breaker — distributed, three-state:**

| State | Behavior | Transition |
|-------|----------|------------|
| CLOSED | All requests pass through | → OPEN after 5 failures in 30s |
| OPEN | Immediate short-circuit, no HTTP calls | → HALF_OPEN after 30s cooldown |
| HALF_OPEN | 1 probe request allowed | → CLOSED on success, → OPEN on failure |

State in Redis: `app:cb:binance:state`. Failure counter: `app:cb:binance:failures` (TTL 30s). Shared across all server instances.

**Fallback cascade:**

6. `MarketDataService` catches `BinanceUnavailableException`.

7. Tier 1 — Stale cache: `GET app:ticker:BTCUSDT:stale`. If exists → return `{ ...dto, stale: true, staleSince, source: 'cache_stale' }` → 200. Header: `X-Data-Source: stale-cache`.

8. Tier 2 — Cross-symbol check: `SCAN 0 MATCH app:ticker:*:stale COUNT 10`. If other symbols have stale data → 503 with `{ error: 'SYMBOL_DATA_UNAVAILABLE', availableSymbols, retryAfter: 10 }`.

9. Tier 3 — Complete unavailability: 503 with `{ error: 'MARKET_DATA_UNAVAILABLE', retryAfter: 30 }`.

**WebSocket notification:** On circuit OPEN → `broadcast('system:status', 'stream:degraded', { source, since, estimatedRecovery })`. On CLOSED → `'stream:restored'`. Sent to all clients via auto-joined `system:status` room.

**Retry configuration:**

| Parameter | Value |
|-----------|-------|
| Max attempts | 4 (1 + 3 retries) |
| Backoff | `min(100ms * 2^n, 5000ms) + rand(0..100ms)` |
| Delays | ~200ms → ~400ms → ~800ms |
| Per-request timeout | 5000ms |
| Circuit threshold | 5 failures / 30s |
| Circuit cooldown | 30s |
| Stale cache TTL | 120s |

**Concurrency handling:** Jitter on retry delays prevents synchronized retries. The distributed circuit breaker in Redis ensures all instances share the same view — one instance detecting the outage stops all instances from calling.

---

## Flow 6: WebSocket disconnect → reconnect

**Trigger:** Connection drops — network failure, server restart, client backgrounded.

**Server-side cleanup:**

1. `handleDisconnect(client)` fires. Detection: ping every 25s, pong timeout 5s. Two missed cycles (60s) or TCP RST → disconnect.

2. Lookup in `Map<socketId, { userId, rooms, connectedAt, lastActivity }>`.

3. For each room: `client.leave(room)`. `HINCRBY app:ws:user_rooms:{userId} {room} -1`. If counter reaches 0 → `HDEL`. Tracks multi-device subscriptions.

4. Delete from connections map. `DECR app:ws:total_connections`. Structured disconnect log.

5. Empty room check. No action on Binance stream — it feeds both WS and REST cache. Update `SET app:ws:room_pop:{room} 0` for monitoring.

**Client-side reconnect:**

6. socket.io config: `{ reconnectionDelay: 1000, reconnectionDelayMax: 30000, randomizationFactor: 0.3, reconnectionAttempts: Infinity }`. Jitter factor 0.3 prevents thundering herd.

7. Each attempt sends `?token={accessToken}&lastEventId={lastEventId}`.

8a. Token expired → disconnect 4001 → client calls `POST /auth/refresh` → retries WS. Refresh also expired → redirect to login.

8b. Token valid → connected, registered, `INCR app:ws:total_connections`.

**Re-subscription:**

9. Batch replay: `socket.emit('subscribe:batch', [...subscriptions])`. Server processes array, joins all rooms, returns single `subscribed:batch` confirmation.

10. Server-side dedup: multi-device user already subscribed from another tab → room counter incremented, no duplicate stream.

**Data gap recovery:**

11. REST backfill: after `subscribed:batch` confirmation, client fires parallel `GET /market/ticker/{symbol}` for each subscribed symbol.

12. Event buffer replay (optional optimization): `lastEventId` compared with current server event ID. If gap < 100 events → replay from `LRANGE app:ws:events:{room} 0 99` (circular buffer, 60s TTL). Large gap → skip replay, REST backfill covers it.

**WS state in Redis:**

| Key | TTL | Purpose |
|-----|-----|---------|
| `app:ws:total_connections` | none | Global connection count |
| `app:ws:user_rooms:{userId}` | none | Per-user room counts (hash) |
| `app:ws:room_pop:{room}` | none | Room population for monitoring |
| `app:ws:events:{room}` | 60s | Circular event buffer (max 100) |

**Concurrency — thundering herd on restart:** Jitter (0.3 factor) spreads reconnections across windows. Server admission rate: `app:ws:admit_rate` — max 500 new connections/second. Excess receives close code 4008 ("Try again later"). Exponential backoff handles the retry.

**Performance:** Event buffer replay (step 12) avoids REST backfill load during mass reconnection events. At 1 event/second, the buffer covers 100s of history — far longer than typical disconnects.
