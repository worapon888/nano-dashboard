# Runtime Flows

ระบบทำงานสามอย่างหลักในฝั่ง frontend และสามอย่างในฝั่ง backend

**Frontend**

1. authenticate กับ backend
2. fetch dashboard snapshot ครั้งแรก
3. รับ incremental update ผ่าน WebSocket

**Backend**

1. auth และ user operations ผ่าน PostgreSQL
2. ดึงข้อมูลตลาดจาก Binance + cache ด้วย Redis
3. aggregate ทุก source เป็น dashboard response เดียว

> ไม่ใช่ทุก flow ที่ "live" เท่ากัน — auth, WebSocket, Binance integration, Redis cache, และ dashboard aggregation เป็น runtime-real ส่วน open orders ใช้ demo seed data เป็นหลัก และ PNL เป็น service-generated ทั้งหมด

---

## 1. Login

```
Frontend form
  → POST /api/auth/login
  → AuthService: normalize email → Prisma lookup → bcrypt verify → JWT sign
  → frontend stores token
  → GET /api/auth/me
  → dashboard boot
```

**Failure:** ไม่มี cache ไม่มี refresh token — credential ผิดหรือ user inactive ล้มเหลวทันที

---

## 2. Register

```
Frontend form
  → POST /api/auth/register
  → AuthService: check uniqueness → bcrypt hash → Prisma create
  → publish user.created → EventsGateway broadcast ไปยัง admin clients
  → เรียก login() ต่อทันที (ทำงานเหมือน login flow ปกติ)
```

**Failure:** email ซ้ำ → 409 Conflict, WebSocket broadcast ล้มเหลวไม่กระทบ registration

---

## 3. Dashboard Summary Fetch

```
GET /api/dashboard/summary
  → ตรวจ hot cache (Redis) → ถ้ามีคืนทันที
  → cache miss → อ่าน stale cache ไว้รอ fallback
  → buildSummary() — เรียก 7 service พร้อมกัน (Promise.allSettled, timeout 7s ต่อตัว)
      ├── UsersService.getActiveCount()
      ├── MarketDataService.getTrackedTickers()
      ├── MarketDataService.getDashboardBtcPriceTrend()
      ├── MarketDataService.getDashboardVolumeProfile()
      ├── PnlService.getWeeklyPnl()
      ├── OrdersService.getOpenOrders()
      └── InternalService.getQuickHealth()
  → assemble DashboardSummaryDto
  → เขียน hot cache (30s) + stale cache (300s)
  → คืน response
```

**Failure:** section ล้มเหลวบางตัว degrade เป็น fallback DTO ได้ — ถ้า build ล้มเลยคืน stale cache หรือ 503

---

## 4. Binance REST Market Data

```
MarketDataService.getTicker(symbol)
  → ตรวจ hot cache → ถ้ามีคืนทันที
  → cache miss → ขอ Redis lock (setNx)
      ├── ได้ lock: ยิง BinanceService.getTicker() (timeout 5s, retry 4 ครั้ง)
      │              → เขียน hot cache (10s) + stale cache (120s)
      │              → publish ผ่าน Redis pub/sub
      └── ไม่ได้ lock: subscribeOnce รอผล → ถ้าหมดเวลา fallback stale cache
```

lock coordination ป้องกัน thundering herd — หลาย request ไม่ยิง Binance พร้อมกัน

---

## 5. Binance WebSocket Live Stream

```
Backend startup
  → BtcPriceLiveService เชื่อมต่อ wss://.../ws/btcusdt@ticker
  → BtcVolumeLiveService เชื่อมต่อ combined kline streams (15m, 1h, 4h, 1d)
  → รับ message → parse → dedupe ด้วย signature
  → publishTicker() → EventsGateway broadcast
      ├── btc.price.updated
      └── btc.volume.updated
```

**Reconnect:** exponential backoff เริ่ม 1s สูงสุด 30s

---

## 6. Frontend WebSocket Lifecycle

```
Dashboard เปิด
  → useDashboardSocket สร้าง WebSocket (URL + ?token=...)
  → socket open → status: live
  → รับ message → parse → route ตาม event → patch local state
  → socket close/error → status: offline → exponential backoff → reconnect
```

ใช้ latest callback refs ป้องกัน stale closure และ duplicate listener

**Reconnect:** เริ่ม 1s สูงสุด 15s

---

## 7. Cache Flow (ภาพรวม)

| Cache             | Hot TTL | Stale TTL | Fallback          |
| ----------------- | ------- | --------- | ----------------- |
| Dashboard summary | 30s     | 300s      | stale → 503       |
| Ticker            | 10s     | 120s      | stale + lock/wait |

stale cache มีไว้ให้ระบบคืนข้อมูลเก่าได้เมื่อ live build ล้มเหลว ดีกว่า error หน้าจอ

---

## 8. user.created / user.updated Events

**user.created** (หลัง register)

```
AuthService สร้าง user → publishUserCreated()
  → EventsGateway broadcast ไปยัง admin clients
  → useDashboardSocket route → page patch local state
```

**user.updated** (admin แก้ไข user)

```
UsersService update Prisma → invalidate Redis caches
  → publishUserUpdated()
  → EventsGateway broadcast ไปยัง admins + user room นั้นๆ
  → frontend อัปเดต local state
```

ทั้งสอง event เป็น fire-and-forget — publish ล้มเหลวไม่ block operation หลัก

---

## 9. Open Orders

```
Dashboard buildSummary → OrdersService.getOpenOrders(userId)
  → Prisma query orders ของ user นั้น
  → map เป็น dashboard DTO (activeCount, totalCount, items)
```

> DB-backed จริง แต่ demo path อาศัย seeded orders ของ `admin@example.com` เป็นหลัก ยังไม่มี order creation API

---

## 10. PNL

```
Dashboard buildSummary → PnlService.getWeeklyPnl(userId, range)
  → ตรวจว่า user คือ admin@example.com
      ├── ใช่: คืน demo series (week / month / year)
      └── ไม่ใช่: คืน empty PNL DTO
```

> ไม่มี PNL model ใน DB — ทั้งหมดเป็น service-generated demo data
