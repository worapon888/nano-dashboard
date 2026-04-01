# Database Design

PostgreSQL schema จัดการผ่าน Prisma ประกอบด้วย 4 model โดยแต่ละ model มีบทบาทในระบบไม่เท่ากัน

---

## ภาพรวม: สองโดเมนที่แยกกันชัด

| โดเมน              | Model                            | สถานะ                      |
| ------------------ | -------------------------------- | -------------------------- |
| Application data   | `users`, `orders`                | Runtime-active ใช้งานจริง  |
| Market persistence | `crypto_prices`, `price_history` | มีใน schema แต่ใช้แค่ seed |

> **หมายเหตุ:** dashboard ณ ปัจจุบันดึงข้อมูลตลาดจาก Binance API + Redis cache ไม่ใช่จาก `crypto_prices` หรือ `price_history` โดยตรง

---

## Models

### `users`

เก็บข้อมูล user สำหรับ authentication, authorization, และ admin management

```
id             String      PK
email          String      UNIQUE
passwordHash   String
displayName    String
role           UserRole    USER | ADMIN
isActive       Boolean
createdAt      DateTime
updatedAt      DateTime
deletedAt      DateTime?   nullable — soft delete
```

**Runtime usage:** ใช้งานหนักที่สุดในระบบ — login, JWT lookup, admin CRUD, active user count สำหรับ dashboard summary

**Soft delete:** ใช้ `deletedAt` — record ยังอยู่ใน DB แต่ query ส่วนใหญ่ filter `deletedAt: null`

---

### `orders`

เก็บ order ของ user สำหรับ dashboard open-orders widget

```
id             String      PK
userId         String      FK -> users.id
pair           String
side           OrderSide   BUY | SELL
type           OrderType   LIMIT | MARKET | STOP | TAKE_PROFIT
price          Decimal
amount         Decimal
filledPercent  Decimal
totalUsd       Decimal
status         OrderStatus OPEN | PARTIAL | FILLED | CANCELLED
createdAt      DateTime
updatedAt      DateTime
```

**Runtime usage:** `OrdersService` query จาก DB จริง แต่ demo path อาศัย seeded rows ของ `admin@example.com` เป็นหลัก — ยังไม่มี order creation/update API

---

### `crypto_prices`

เก็บ price snapshot ล่าสุดแต่ละ symbol

```
id              String    PK
symbol          String    UNIQUE
price           Decimal
volume24h       Decimal
priceChange24h  Decimal
high24h         Decimal
low24h          Decimal
source          String
fetchedAt       DateTime
createdAt       DateTime
updatedAt       DateTime
```

**Runtime usage:** มีใน schema และ seed (BTCUSDT, ETHUSDT) แต่ dashboard ไม่ได้ query table นี้ที่ runtime — live market data ไหลผ่าน Binance + Redis แทน

---

### `price_history`

เก็บ historical snapshot ที่ผูกกับ `crypto_prices`

```
id              String    PK
cryptoPriceId   String    FK -> crypto_prices.id
symbol          String
price           Decimal
volume24h       Decimal
priceChange24h  Decimal
high24h         Decimal
low24h          Decimal
source          String
recordedAt      DateTime
createdAt       DateTime
```

**Runtime usage:** seed เท่านั้น — dashboard trend chart ดึงข้อมูลจาก Binance kline API โดยตรง ไม่ผ่าน table นี้

---

## Relationships

```
users ──── 1:many ──── orders
             (orders.userId → users.id, cascade delete/update)

crypto_prices ──── 1:many ──── price_history
             (price_history.cryptoPriceId → crypto_prices.id, cascade delete/update)
```

---

## Data Sources ณ Runtime

```
DB-backed          users, orders
Cache-backed       active user count, ticker cache, dashboard summary cache
External API       top movers, BTC price trend, volume profile
Demo/generated     PNL series
```

---

## สิ่งที่ยังไม่มีใน Schema

- PNL model (ปัจจุบัน service-generated)
- Session / refresh token table
- Portfolio หรือ position model
- Dashboard summary persistence
- WebSocket event store
