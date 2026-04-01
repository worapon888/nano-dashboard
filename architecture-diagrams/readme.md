# Crypto Market Dashboard

แอปพลิเคชัน crypto market dashboard แบบ realtime แบ่งเป็น frontend และ backend ที่คุยกันผ่าน REST API และ WebSocket

---

## Tech Stack

| Layer    | เทคโนโลยี                                        |
| -------- | ------------------------------------------------ |
| Frontend | React, TypeScript, Tailwind CSS, ApexCharts      |
| Backend  | NestJS, Fastify, Prisma, Redis, native WebSocket |
| Database | PostgreSQL                                       |
| External | Binance REST API, Binance WebSocket Streams      |

---

## สถาปัตยกรรมโดยรวม

Backend ออกแบบเป็น **modular monolith** — แต่ละ module มีขอบเขตและความรับผิดชอบชัดเจน แต่ยังอยู่ใน deployable เดียวกัน

### หลักการสำคัญ: Frontend ไม่แตะ External โดยตรง

Frontend ไม่ติดต่อ Binance หรือ database เลย ทุกอย่างผ่าน backend สองจุดเท่านั้น

```
GET /api/dashboard/summary   →  ดึงข้อมูลรวม dashboard ครั้งแรก
WS  /ws                      →  รับ realtime update แบบ incremental
```

Binance payload ถูก normalize โดย backend ก่อน แล้วถูก map อีกครั้งใน frontend เป็น widget model ผลคือ UI ไม่ผูกกับ external contract โดยตรง

---

## Backend Modules

| Module             | หน้าที่                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| `auth`             | login, register, JWT validation, bcrypt, token 15 นาที                                                   |
| `users`            | admin CRUD, active user count, cache invalidation, publish event                                         |
| `dashboard`        | orchestrator หลัก — aggregate ข้อมูลจากทุก service พร้อม cache และ fallback                              |
| `market-data`      | ticker snapshot, BTC trend, volume profile + consume Binance live stream                                 |
| `binance`          | outbound REST call ไปยัง Binance พร้อม timeout/retry                                                     |
| `events`           | WebSocket gateway ที่ `/ws` — authenticate client, broadcast event, เป็น publisher token ให้ module อื่น |
| `internal`         | health check รวม DB + Redis + WS connection count                                                        |
| `orders` / `pnl`   | คืน open orders และ PNL ให้ dashboard (บาง path ยังเป็น demo data)                                       |
| `redis` / `prisma` | infrastructure layer สำหรับ cache และ ORM                                                                |

> **หมายเหตุ:** `EventsGateway` ถูก bind เป็น DI token สามตัว — `USER_EVENTS_PUBLISHER`, `MARKET_EVENTS_PUBLISHER`, `WS_CONNECTIONS_PROVIDER` — ทำให้ module อื่น inject และ publish event ได้โดยไม่ต้อง depend on gateway โดยตรง

---

## Dashboard Aggregation

เมื่อ frontend เรียก `GET /api/dashboard/summary` ระบบทำงานตามลำดับนี้

```
1. ตรวจ hot cache → ถ้ามีคืนทันที
2. cache miss → อ่าน stale cache ไว้รอ fallback
3. เรียก 7 service พร้อมกันผ่าน Promise.allSettled()
   ├── active users
   ├── tickers (top movers)
   ├── BTC price trend
   ├── BTC volume profile
   ├── PNL summary
   ├── open orders
   └── internal health
   (แต่ละตัว timeout 7 วินาที)
4. Assemble ผลลัพธ์เป็น DashboardSummaryDto
5. เขียน hot cache (TTL 30s) และ stale cache (TTL 300s)
6. ถ้า build ล้มเหลว → คืน stale data พร้อม flag หรือ throw ServiceUnavailableException
```

---

## Cache Strategy

ออกแบบมาเพื่อความ **resilient** มากกว่าแค่ performance

| Layer             | วัตถุประสงค์                                         | TTL                                   |
| ----------------- | ---------------------------------------------------- | ------------------------------------- |
| Hot cache         | ลด repeated load                                     | 30s (dashboard), ต่างกันสำหรับ ticker |
| Stale cache       | ป้องกัน UI พังเมื่อ live build ล้มเหลว               | 300s                                  |
| Lock coordination | ป้องกัน thundering herd ด้วย Redis `setNx` + pub/sub | —                                     |

เมื่อหลาย request race กันไป fetch ticker เดิมพร้อมกัน ระบบให้ตัวแรกที่ได้ lock เป็นคนดึงข้อมูล ส่วนตัวที่เหลือรอผ่าน pub/sub แทนที่จะยิง request ซ้ำออกไป

---

## Realtime WebSocket Flow

Binance stream สองเส้นทำงานขนานกันอิสระ

```
btcusdt@ticker  →  BtcPriceLiveService  →  parse + dedupe  →  broadcast "btc.price.updated"
btcusdt kline   →  BtcVolumeLiveService →  parse + dedupe  →  broadcast "btc.volume.updated"
```

ฝั่ง frontend hook `useDashboardSocket` รับ event, validate payload shape, แล้ว **patch state ที่มีอยู่** — ไม่ refetch ใหม่ทั้งหมดทุกครั้งที่มี update

---

## Trade-offs และข้อจำกัด

### ที่ตั้งใจแล้ว

**Modular monolith แทน microservices** — boundary สะอาดพอ ขยายได้ในอนาคต แต่ deploy และ debug ง่ายกว่าในตอนนี้

**Incremental patch แทน full refetch** — UI responsive กว่า แต่ต้องดูแล local-state merge ให้ถูกต้อง

**Frontend insulated จาก external contract** — Binance payload ไม่รั่วขึ้นมาถึง UI layer

### ที่ยังไม่ครบ

- CORS origin hardcode ใน `main.ts`
- ไม่มี refresh token flow
- Observability เป็นแค่ log ยังไม่มี metrics/tracing
- PNL ยังเป็น demo series ไม่ใช่ live calculation
- Table รองรับ resizable columns แต่ยังไม่มี expandable rows
