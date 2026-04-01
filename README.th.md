# NanoDashboard

NanoDashboard เป็นผลงาน take-home assignment สำหรับตำแหน่ง Mid-Senior Fullstack Developer โดยสร้างเป็น trading-style dashboard ที่มีทั้ง React frontend และ NestJS backend จุดเน้นของโปรเจกต์นี้มีสองส่วนหลัก คือฝั่ง UI ที่ปรับแต่ง layout ของ widget ได้จริง และฝั่ง backend ที่รวมข้อมูลผู้ใช้ ข้อมูลตลาดที่มี cache และ event แบบ realtime ให้ออกมาเป็น dashboard contract เดียวสำหรับ frontend ใช้งาน

แนวทางการทำไม่ได้ตั้งใจทำเป็นแค่ชุดหน้าจอหรือ API demo แยกส่วนกัน แต่ทำให้ใกล้กับ product slice ขนาดเล็กที่ยัง review ด้าน architecture ได้จริง ฝั่ง frontend รองรับ drag, resize, widget composition, chart หลายประเภท, table แบบปรับขนาดคอลัมน์ได้ และ realtime update ส่วน backend มี JWT auth, user CRUD, Binance REST และ WebSocket integration, Redis cache, websocket broadcasting และ aggregated dashboard endpoint ที่มี timeout / fallback behavior

โปรเจกต์นี้ไม่ได้ถูกนำเสนอว่าเป็นระบบเทรด production-grade แบบสมบูรณ์ ทุกส่วนที่เป็น production-like จะระบุอย่างตรงไปตรงมา เช่น service separation, validation, cache strategy และ degraded-state handling ขณะที่ส่วนที่ยังเป็น demo-oriented เช่น seeded order / PNL data หรือ operational tooling ที่ยังไม่ครบ ก็จะระบุไว้ชัดเจนเช่นกัน

## Live Demo
- Frontend URL: `<REPLACE_WITH_FRONTEND_URL>`
- Backend URL: `<REPLACE_WITH_BACKEND_URL>`
- API docs URL: `N/A - ยังไม่ได้เปิด Swagger/OpenAPI; ดู API Summary ด้านล่าง`

## Overview
โปรเจกต์นี้แก้โจทย์ assignment ในรูปแบบ fullstack dashboard ที่เชื่อม frontend และ backend เข้าด้วยกันจริง ฝั่ง frontend ถูกออกแบบให้เป็น workspace ที่ผู้ใช้จัดตำแหน่ง widget, ปรับขนาด, reset layout และดูข้อมูล realtime ได้ ส่วน backend ถูกออกแบบให้ตอบโจทย์การ consume ข้อมูลแบบ dashboard โดยเฉพาะ แทนที่จะส่ง raw external payload ให้ frontend ใช้งานตรง ๆ

แนวคิดนี้สำคัญในมุม reviewer เพราะ frontend ไม่ควรต้องรู้ว่า Binance ส่ง field อะไรมา มี retry อย่างไร หรือใช้ cache key แบบไหน ความซับซ้อนเหล่านั้นถูกซ่อนไว้ใน backend แล้ว expose ออกมาเป็น `/api/dashboard/summary` ที่เป็น contract สำหรับ dashboard โดยเฉพาะ ขณะเดียวกัน websocket จะส่ง update เฉพาะส่วน เช่น BTC price, BTC volume และ user events ทำให้ client โฟกัสเรื่อง rendering และ interaction ได้ชัดเจนกว่า

## Assignment Coverage
### Frontend Requirements
- Drag / Resize / Arrange
  - Status: Done
  - Implementation: Dashboard ใช้ custom layout engine ใน `web/src/features/dashboard/lib` ร่วมกับ pointer-driven hooks เช่น `useWidgetDrag`, `useWidgetResize` และ controller ใน `useDashboardLayoutController` ตำแหน่งและขนาดของ widget ไม่ได้ถูก hardcode เป็น grid ตายตัว แต่คำนวณจากระบบ layout ของแอปเอง
  - Notes: เลือกทำ custom behavior มากกว่าพึ่ง dashboard package โดยตรง เพื่อควบคุม collision handling, docking/minimize/maximize และ resize constraints ได้ละเอียดขึ้น

- 4 Chart Types
  - Status: Done
  - Implementation: ระบบ chart รองรับ line, bar, column และ pie ผ่าน widget composition layer ที่ `dashboardDefinition.ts` และ chart utilities ใน `web/src/features/chart` ปัจจุบันใช้กับ BTC trend, volume profile, daily PNL และ market share breakdown
  - Notes: ใช้ ApexCharts เป็น rendering engine แต่ logic การ map data และ option ยังคุมภายในโปรเจกต์

- Table: Resizable Columns / Expandable Rows
  - Status: Partial
  - Implementation: Open orders table รองรับ resizable columns ผ่าน `useColumnResize`, sticky header, การเก็บความกว้างของแต่ละคอลัมน์ และ scroll ภายใน widget
  - Notes: Expandable rows ยังไม่ได้ implement ในเวอร์ชันปัจจุบัน โดยเลือก prioritize เรื่อง column resizing และ widget-fit behavior ก่อน

- getDateRange Utility
  - Status: Done
  - Implementation: `web/src/shared/utils/dateRange.ts` parse input date แบบปลอดภัย และคืนค่า `start` / `end` แบบ UTC normalized สำหรับ `day`, `week`, `month`, `year`
  - Notes: utility ถูกแยกจาก widget rendering ทำให้ test ได้ง่ายและไม่ผูกกับ UI

- Realtime UI Updates
  - Status: Done
  - Implementation: `useDashboardSocket` ดูแล websocket lifecycle, message parsing, reconnect backoff และ safe callback dispatch สำหรับ BTC price, BTC volume และ user events
  - Notes: callback references ถูกเก็บใน refs เพื่อหลีกเลี่ยง stale closure และ duplicate listener issue

### Backend Requirements
- Users CRUD + JWT
  - Status: Done
  - Implementation: `AuthController` รองรับ register, login และ `me`; `UsersController` รองรับ list, get-by-id, update และ delete โดยใช้ JWT guard และ role guard สำหรับ admin route
  - Notes: มี access token อายุ 15 นาที แต่ยังไม่มี refresh-token flow

- WebSocket: `user.created` / `user.updated`
  - Status: Done
  - Implementation: `EventsGateway` เปิด pure WebSocket endpoint ที่ `/ws`, authenticate client ได้จาก bearer token หรือ query token และ broadcast domain events แบบ scoped
  - Notes: admin client ได้รับ user event กว้างกว่า client ทั่วไป และมี room-style delivery สำหรับ authenticated user

- Binance REST + WebSocket
  - Status: Done
  - Implementation: `BinanceService` ใช้ REST สำหรับ ticker / kline data พร้อม retry และ timeout ส่วน `BtcPriceLiveService` และ `BtcVolumeLiveService` ใช้ Binance websocket stream สำหรับ BTC updates แบบ incremental
  - Notes: ขอบเขต realtime stream จงใจจำกัดไว้ที่ BTC-related use case ตาม assignment ไม่ได้เป็น full exchange stream system

- Redis Cache
  - Status: Done
  - Implementation: `RedisService` รองรับ typed get/set/delete และ degrade gracefully เมื่อ Redis ใช้งานไม่ได้ ส่วน `DashboardService` ใช้ hot cache และ stale cache แยก TTL กัน
  - Notes: ค่า TTL ปัจจุบันคือ 30 วินาทีสำหรับ hot cache และ 300 วินาทีสำหรับ stale fallback cache

- GET `/dashboard`
  - Status: Done
  - Implementation: implement ในชื่อ `GET /api/dashboard/summary` ซึ่งทำหน้าที่เป็น aggregated dashboard endpoint ตามโจทย์
  - Notes: ชื่อ route เป็น `summary` ไม่ใช่ `/dashboard` ตรง ๆ แต่ fulfill aggregation requirement เดียวกัน

- Internal API Layer
  - Status: Done
  - Implementation: `InternalService` รวม health ของ DB, Redis และ websocket connection count เพื่อให้ dashboard summary consume ได้โดยไม่ต้องผูกกับ infra logic โดยตรง
  - Notes: layer นี้ยังแคบตาม scope assignment แต่แสดง pattern ของ internal orchestration ได้ชัดเจน

- Database Design
  - Status: Done
  - Implementation: Prisma schema มี `User`, `Order`, `CryptoPrice`, `PriceHistory` พร้อม index ตาม query pattern เช่น symbol lookup, time-series access และ user/order filtering
  - Notes: schema เหมาะกับ assignment scope แต่ยังไม่ใช่ audit-grade trading ledger

- Architecture Decision
  - Status: Done
  - Implementation: ระบบถูกออกแบบเป็น modular monolith แบ่งเป็น feature modules และ service boundaries แทนการแยกเป็น microservices
  - Notes: เหตุผลอธิบายต่อในหัวข้อ Architecture Decision

## Tech Stack
- Frontend
  - React 19
  - TypeScript
  - Tailwind CSS
  - ApexCharts / react-apexcharts
  - Axios
  - Lenis

- Backend
  - NestJS
  - TypeScript
  - Fastify adapter สำหรับ NestJS
  - Native WebSocket gateway ผ่าน `ws`
  - JWT authentication
  - Prisma ORM

- Data / Infra
  - PostgreSQL
  - Redis
  - Binance REST API
  - Binance WebSocket streams

- Testing
  - Jest สำหรับ backend unit/integration/e2e
  - Vitest + Testing Library สำหรับ frontend unit/integration
  - Playwright สำหรับ browser-level e2e

## Why This Stack
React + TypeScript เป็นตัวเลือกที่เหมาะกับ assignment นี้เพราะ UI เน้น interaction สูง ไม่ใช่หน้า content-static ธรรมดา ทั้ง drag, resize, panel collision, table resizing, websocket-driven state updates และ widget หลายประเภท ล้วนได้ประโยชน์จาก component composition และ type boundary ที่ชัดเจน Tailwind ถูกเลือกเพราะช่วย iterate ดีไซน์ dashboard แบบ custom ได้เร็ว โดยไม่ต้องแบก design system ขนาดใหญ่ ส่วน ApexCharts ตอบ requirement เรื่อง chart types ได้ครบ และยังเปิดโอกาสให้ application คุม chart configuration เองได้

NestJS / Node.js ถูกเลือกแทน FastAPI เพราะโจทย์นี้ไม่ได้เป็นแค่ REST CRUD แต่มีทั้ง websocket gateway, JWT guard, service/module separation, external websocket consumer และ realtime event broadcasting อยู่ในระบบเดียว NestJS ให้โครงสร้างเรื่อง controller, provider, module, guard และ testing ที่เหมาะกับงานลักษณะนี้มาก FastAPI ก็เป็นตัวเลือกที่ดีสำหรับ REST-heavy service แต่สำหรับ assignment นี้มันไม่ได้ลดความซับซ้อนรวมของระบบ เพราะยังต้องจัดการ websocket orchestration และ service separation อยู่ดี อีกเหตุผลหนึ่งคือการใช้ TypeScript ทั้ง frontend และ backend ช่วยลด context switching และทำให้ reasoning เรื่อง DTO, event และ payload consistency ดีขึ้น

Prisma ถูกเลือกเพราะโปรเจกต์นี้ได้ประโยชน์จาก schema readability และ data access code ที่ชัดเจนมากกว่าการ optimize SQL แบบ low-level ตั้งแต่ต้น ส่วน Redis ถูกเลือกเพราะ dashboard workload เป็นลักษณะ aggregated read ที่พึ่งพา upstream external API ดังนั้น cache ทำหน้าที่เป็นทั้ง performance layer และ reliability shield ได้พร้อมกัน

## Architecture Decision
โปรเจกต์นี้เลือกใช้ modular monolith เพราะเหมาะที่สุดกับ take-home assignment ขนาดนี้ โจทย์ต้องมี structure มากพอให้ reviewer เห็นการแยก concern, service boundary และแนวทาง scalability แต่ยังไม่ต้องแบก operational overhead ของ microservices เต็มรูปแบบ

ถ้าออกแบบเป็น microservices จริง user management, market data ingestion, dashboard aggregation และ websocket broadcasting สามารถแยกเป็น service คนละตัวได้ แต่ใน assignment นี้ การทำแบบนั้นจะเพิ่ม complexity ด้าน service discovery, inter-service auth, event transport และ deployment coordination มากกว่ามูลค่าที่เพิ่มให้ reviewer เห็นด้าน engineering

การใช้ modular monolith ทำให้ focus อยู่ที่ code quality และ architecture decision มากกว่า infra ceremony แต่ละ Nest module เช่น `auth`, `users`, `market-data`, `dashboard`, `events`, `orders`, `pnl` ก็ยังเป็น boundary ที่ดีอยู่แล้ว และ internal service layer ก็ช่วยลด coupling ตรง ๆ ระหว่าง feature ถ้าระบบต้อง scale ต่อจริง ส่วนที่ควรถูก extract ก่อนน่าจะเป็น market data ingestion / caching เพราะมี dependency profile และ reliability concern แยกจาก domain อื่นชัดที่สุด

## Frontend Implementation
### Dashboard layout engine
Dashboard layout ถูกขับด้วย panel geometry ที่กำหนดโดยแอปเอง ไม่ใช่ fixed marketing-grid layout โมดูลใน `web/src/features/dashboard/lib` รับผิดชอบเรื่อง panel position, row alignment, resize consequence, collision behavior และ default restore ทำให้ dashboard มี behavior แบบ workspace จริง

### Drag and resize behavior
Drag และ resize ถูกจัดการผ่าน pointer-event hooks เช่น `useWidgetDrag` และ resize hooks อื่น ๆ โดยใช้ pointer capture เพื่อให้ interaction เสถียร และให้ dashboard layout controller เป็นคนคุม state transition แทนการ mutate style แบบกระจัดกระจาย

### Widget composition
การประกอบ widget ถูก centralize ไว้ใน `createTradingDashboardDefinition` หน้า dashboard จะส่ง normalized summary data เข้า widget factories สำหรับ line, bar, column, pie และ table วิธีนี้ช่วยไม่ให้ widget แต่ละตัวต้องพึ่ง raw API contract โดยตรง

นี่คือคำตอบหลักของคำถามว่า frontend ป้องกันการผูกกับ external API structure อย่างไร เพราะ Binance payload ถูก normalize ที่ backend ก่อน แล้ว frontend ก็ยัง map ต่อเข้า widget-specific presentation model อีกชั้นหนึ่ง

### Chart implementation
Charts ใช้ ApexCharts เป็น rendering layer แต่คุมผ่าน chart model และ option builders ภายในแอป ปัจจุบันครอบคลุม:
- BTC price trend: line chart
- Market share breakdown: pie chart
- Volume profile: bar chart
- Daily PNL: column chart

### Table implementation
Open orders table ถูกออกแบบให้ทำงานภายใน widget ที่ resize ได้ รองรับ sticky header, resizable columns, persistent widths และ overflow handling ที่เข้ากับ dashboard โดยตั้งใจทำให้เหมาะกับพื้นที่จำกัดของ widget มากกว่าการทำ table เต็มหน้า Expandable rows ยังไม่ได้ implement ในเวอร์ชันนี้

### getDateRange utility
`getDateRange` เป็น utility ขนาดเล็กที่แยกออกมาต่างหาก รับ input date และ range type (`day`, `week`, `month`, `year`) แล้วคืนค่า UTC boundaries ที่ normalize แล้ว ทำให้ test ได้ง่ายและไม่ปนกับ rendering logic

### Realtime UI updates
Frontend เชื่อม `/ws` ผ่าน `useDashboardSocket` โดย hook นี้รับผิดชอบ:
- สร้าง websocket URL จาก `VITE_API_BASE_URL`
- ส่ง JWT ผ่าน query token
- reconnect แบบ exponential backoff
- cleanup socket และ handler เดิมเมื่อ unmount หรือ disable
- เก็บ latest callbacks ไว้ใน refs เพื่อลด stale closure และ duplicate listener problem

นี่คือคำตอบหลักว่าจัดการ websocket reconnect และ duplicate listener issue อย่างไรในฝั่ง client

## Backend Implementation
### Auth and JWT
Authentication อยู่ในโมดูล `auth` Registration hash password ด้วย bcrypt, login ออก JWT access token และ route ที่ต้อง auth ใช้ JWT guard ส่วน admin-only route ใช้ role-based authorization เพิ่มเติม

### Users CRUD
โมดูล `users` เปิด endpoint:
- `GET /api/users`
- `GET /api/users/me`
- `GET /api/users/:id`
- `PATCH /api/users/:id`
- `DELETE /api/users/:id`

โดย list, get-by-id, update และ delete ถูกจำกัดให้ admin เท่านั้น ส่วน `me` ใช้ได้กับ authenticated user ทุกคน

### WebSocket events
`EventsGateway` ใช้ pure WebSocket endpoint ที่ `/ws` ทำหน้าที่ authenticate client แบบ optional, เก็บ connection count, รองรับ room-style scoped delivery และ broadcast event ต่อไปนี้:
- `user.created`
- `user.updated`
- `btc.price.updated`
- `btc.volume.updated`
- ticker events ตามต้องใช้

### Binance REST integration
`BinanceService` เป็น REST integration boundary โดยมี:
- request timeout 5 วินาที
- retry สูงสุด 4 ครั้ง
- retry เฉพาะ network / HTTP status ที่ควร retry (`429`, `502`, `503`, `504`)
- ไม่ retry สำหรับ status ที่ไม่ควร เช่น `400`, `403`, `418`

### Binance realtime stream handling
Realtime BTC update ใช้ `BtcPriceLiveService` และ `BtcVolumeLiveService` โดย parse เฉพาะ field ที่ dashboard ต้องใช้, กัน duplicate rebroadcast ด้วย signature comparison และ reconnect เมื่อ stream หลุด

### Aggregated `/dashboard` endpoint
Main aggregation endpoint คือ `GET /api/dashboard/summary` ซึ่ง compose ข้อมูลต่อไปนี้:
- active user count
- top movers
- market overview
- market share
- BTC price trend
- BTC volume profile
- daily PNL
- open orders
- internal health summary

route นี้มีไว้เพื่อให้ frontend ใช้ dashboard contract เดียว แทนการยิงหลาย endpoint แล้ว compose เองบน client

### Cache strategy
Dashboard summary ใช้ Redis-backed cache สองระดับ:
- hot cache: 30 วินาที
- stale cache: 300 วินาที

hot cache ลดการ recompute และลดการเรียก upstream ซ้ำสำหรับ dashboard refresh ส่วน stale cache ใช้เป็น degraded fallback เมื่อ live build path ล้มเหลว

นี่คือคำตอบหลักว่ากลยุทธ์ cache ลด Binance call อย่างไร เพราะ dashboard refresh หลายครั้งในช่วง TTL จะอ่านจาก Redis แทนการไป Binance ใหม่ทุกครั้ง และเมื่อ build ไม่สำเร็จ stale snapshot ก็ช่วยหลีกเลี่ยงการเรียก upstream เพิ่มพร้อมกับลดผลกระทบต่อ UI

### Internal API/service layer
`InternalService` รวม health ของ:
- database connectivity
- Redis availability
- websocket connection count

ทำให้ dashboard service ไม่ต้องทำ infra checks เองตรง ๆ และยังเป็นตัวอย่างของ internal-only orchestration layer ที่ต่อไปสามารถขยายหรือ extract ได้

### Error handling / timeout / retry / fallback
Backend ใช้ defensive layers หลายชั้น:
- Binance REST retry เมื่อเจอ failure แบบที่ควร retry
- dashboard section แต่ละตัวถูกห่อด้วย timeout 7 วินาที
- section-level failure degrade เป็น fallback data ได้
- successful build จะเขียนทั้ง hot และ stale cache
- ถ้า fresh build fail แต่เคยมี snapshot เดิมอยู่ จะคืน stale cache แทน error ทันที

ถ้า Binance fail หรือช้าเกินไป พฤติกรรมจะขึ้นกับ path ที่ได้รับผลกระทบ โดย REST fetch จะ retry ก่อน ถ้ายัง fail หรือ timeout section นั้นจะ fallback เป็น payload ว่างหรือค่า default และเพิ่ม warning เข้า summary ถ้าระดับ summary ยัง build ไม่สำเร็จอีก stale cache จะถูกคืนถ้ามี

## Data Flow
flow แบบ end-to-end คือ:

Binance REST / Binance WebSocket  
→ `BinanceService`, `BtcPriceLiveService`, `BtcVolumeLiveService`  
→ market-data normalization และ dashboard composition services  
→ Redis hot/stale cache และ PostgreSQL-backed domain data ในส่วนที่เกี่ยวข้อง  
→ `GET /api/dashboard/summary` สำหรับ initial hydration  
→ frontend summary normalization และ widget composition  
→ websocket incremental updates ที่ apply เข้า widget state โดยตรง

จุดสำคัญคือ frontend consume dashboard-specific data ไม่ได้ผูกกับ exchange payload โดยตรง ทำให้ external API volatility ถูก absorb ไว้ที่ backend

## Project Structure
```text
nanodashboard/
├─ api/
│  ├─ prisma/
│  │  ├─ schema.prisma
│  │  ├─ seed.ts
│  │  └─ migrations/
│  ├─ src/
│  │  ├─ auth/
│  │  ├─ users/
│  │  ├─ dashboard/
│  │  ├─ market-data/
│  │  ├─ binance/
│  │  ├─ events/
│  │  ├─ internal/
│  │  ├─ orders/
│  │  ├─ pnl/
│  │  ├─ prisma/
│  │  ├─ redis/
│  │  ├─ common/
│  │  ├─ app.module.ts
│  │  └─ main.ts
│  └─ test/
├─ web/
│  ├─ e2e/
│  ├─ src/
│  │  ├─ pages/
│  │  ├─ services/
│  │  ├─ types/
│  │  ├─ shared/
│  │  └─ features/
│  │     ├─ dashboard/
│  │     ├─ chart/
│  │     └─ table/
│  ├─ playwright.config.ts
│  └─ package.json
└─ README.th.md
```

ส่วนสำคัญ:
- `api/src/dashboard`: dashboard aggregation, cache policy, fallback behavior
- `api/src/market-data`: market snapshot + BTC live stream services
- `api/src/events`: websocket gateway และ event publisher/provider contracts
- `web/src/features/dashboard`: layout engine, drag/resize hooks, workspace composition
- `web/src/features/chart`: chart rendering model และ chart presentation
- `web/src/features/table`: open-orders table ที่ปรับขนาดคอลัมน์ได้

## Setup Instructions
### Prerequisites
- Node.js 20+ แนะนำ
- PostgreSQL
- Redis
- npm

### 1. Install dependencies
```bash
cd api
npm install

cd ../web
npm install
```

### 2. Backend environment setup
สร้าง `api/.env`:

```env
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/nanodashboard
REDIS_URL=redis://localhost:6379
JWT_SECRET=<replace-with-secure-secret>
BINANCE_BASE_URL=https://api.binance.com
BINANCE_WS_BASE_URL=wss://stream.binance.com:9443/ws
BINANCE_LIVE_STREAM_ENABLED=true
PORT=3000
```

### 3. Frontend environment setup
สร้าง `web/.env`:

```env
VITE_API_BASE_URL=http://localhost:3000
```

### 4. Database migration
```bash
cd api
npx prisma migrate dev
```

### 5. Seed demo data
```bash
cd api
npm run db:seed
```

seed นี้จะสร้าง:
- demo admin user
- sample crypto prices / price history
- demo orders สำหรับ seeded admin path

### 6. Start backend
```bash
cd api
npm run start:dev
```

backend จะรันที่:
- `http://localhost:3000`
- websocket path: `ws://localhost:3000/ws`

### 7. Start frontend
```bash
cd web
npm run dev
```

frontend จะรันที่:
- `http://localhost:5173`

## Environment Variables
| Variable | Example | Used by current code | Purpose |
|---|---|---:|---|
| `DATABASE_URL` | `postgresql://user:password@localhost:5432/nanodashboard` | Yes | Prisma/PostgreSQL connection |
| `REDIS_URL` | `redis://localhost:6379` | Yes | Redis cache connection |
| `JWT_SECRET` | `<secure-secret>` | Yes | ใช้ sign/verify JWT |
| `BINANCE_BASE_URL` | `https://api.binance.com` | Yes | Binance REST base URL |
| `BINANCE_WS_BASE_URL` | `wss://stream.binance.com:9443/ws` | Yes | Binance websocket base URL |
| `BINANCE_LIVE_STREAM_ENABLED` | `true` | Yes | เปิด/ปิด backend BTC live stream consumers |
| `PORT` | `3000` | Yes | backend HTTP port |
| `VITE_API_BASE_URL` | `http://localhost:3000` | Yes | frontend REST + websocket base origin |
| `FRONTEND_URL` | `http://localhost:5173` | No, recommended | โดยทั่วไปควรใช้สำหรับ CORS ใน production แต่โค้ดปัจจุบันยัง hardcode localhost ใน `main.ts` |
| `NODE_ENV` | `development` | Implicitly | มีผลต่อ behavior บางอย่างใน test/runtime |

## Testing
โปรเจกต์นี้มี test หลายชั้น

- Backend unit/integration tests
  - Focus: service logic, fallback behavior, Binance integration behavior, dashboard aggregation
  - Command:
```bash
cd api
npm test
```

- Backend e2e tests
  - Focus: Nest HTTP routes และ end-to-end API behavior
  - Command:
```bash
cd api
npm run test:e2e
```

- Frontend unit/integration tests
  - Focus: layout logic, socket behavior, service normalization, widget interactions
  - Command:
```bash
cd web
npm test
```

- Frontend browser-level e2e
  - Focus: Playwright-backed browser flows
  - Command:
```bash
cd web
npm run test:e2e
```

นอกจากนี้ยังมี realtime proof ผ่านตัวแอปเอง และ integration coverage ที่เกี่ยวข้อง เช่น `DashboardPage.realtime.integration.test.tsx` และ `useDashboardSocket.test.tsx`

## API Summary
Important HTTP endpoints ที่ implement แล้ว:

- Auth
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/me`

- Users
  - `GET /api/users`
  - `GET /api/users/me`
  - `GET /api/users/:id`
  - `PATCH /api/users/:id`
  - `DELETE /api/users/:id`

- Market Data
  - `GET /api/market/ticker/:symbol`

- Dashboard
  - `GET /api/dashboard/summary`

- WebSocket
  - `WS /ws`
  - Events: `user.created`, `user.updated`, `btc.price.updated`, `btc.volume.updated`

ปัจจุบันยังไม่ได้เปิด Swagger/OpenAPI และยังไม่มี Postman collection ใน repo

## Performance and Reliability
กลไก reliability หลักเป็น pragmatic มากกว่า infra-heavy เต็มรูปแบบ

- Cache hit/miss behavior
  - Dashboard จะลอง hot cache ก่อน จากนั้น stale cache แล้วค่อย live build
  - successful build จะ repopulate ทั้ง hot และ stale cache

- TTL
  - Hot cache: 30 วินาที
  - Stale cache: 300 วินาที

- Retry logic
  - Binance REST retry ได้สูงสุด 4 attempts เมื่อเข้าเงื่อนไข retryable

- Timeout behavior
  - Dashboard subsection แต่ละตัวถูกจำกัด timeout ที่ 7 วินาที เพื่อไม่ให้ dependency ตัวเดียวค้างทั้ง summary

- Fallback/stale data strategy
  - subsection เช่น BTC trend, volume profile, PNL, open orders, market overview degrade เป็น fallback payload ได้
  - ถ้า fresh build ยัง fail ที่ระดับ summary แต่มี stale cache เดิม จะคืน stale cache แทน

- Reconnect behavior
  - backend BTC live stream consumers reconnect แบบ exponential backoff
  - frontend websocket reconnect แบบ exponential backoff และ cleanup socket handler เดิมก่อน reconnect

ไม่มีการอ้างเลข latency หรือ throughput แบบ benchmark เพราะยังไม่ได้วัดอย่างเป็นทางการ

## Challenges and Solutions
- WebSocket reconnect และ listener lifecycle
  - Solution: รวมการจัดการ socket ไว้ใน `useDashboardSocket`, cleanup ชัดเจน และใช้ callback refs เพื่อลด stale closure / duplicate listeners

- ความไม่เสถียรของ Binance upstream
  - Solution: ใช้ REST retry policy, section-level timeout, fallback payloads และ stale-cache return path

- ป้องกันไม่ให้ frontend ผูกกับ external API structure
  - Solution: ใช้ backend dashboard DTO และ frontend widget composition layer โดย normalize Binance payload ที่ server ก่อน แล้ว map ต่อที่ client

- Dashboard layout collision และ resize behavior
  - Solution: ใช้ dedicated dashboard layout resolution logic แทนการจัดตำแหน่งด้วย CSS แบบ hardcoded

- ป้องกัน cache corruption จาก payload รุ่นเก่าหรือ partial payload
  - Solution: มี cache parse guards ที่ invalid incomplete cache entry และบังคับ rebuild

- ลด noise จาก realtime stream / duplicate payload
  - Solution: ใช้ signature-based duplicate suppression ใน BTC live stream services ก่อน rebroadcast

## Trade-offs / Known Limitations
- Open orders และ daily PNL ยังมีส่วนที่เป็น demo-oriented สำหรับ seeded admin user โดยข้อมูลสองส่วนนี้อิง seed data มากกว่าข้อมูล brokerage จริง
- โครงสร้างระบบมีความ production-like แต่ observability ยังไม่ครบ เช่น metrics, tracing, alerting และ operational dashboards
- CORS config ปัจจุบัน hardcode localhost ใน `main.ts`; production ควร externalize เป็น env
- ยังไม่มี refresh-token flow หรือ long-lived session management
- Table row expansion ยังไม่ได้ implement
- แม้ schema จะรองรับ market data persistence แต่ assignment เวอร์ชันนี้ยังเน้น dashboard consumption และ live updates มากกว่าการเก็บข้อมูลระยะยาวเพื่อ analytics

## Future Improvements
- เพิ่ม browser-level degraded-state e2e coverage สำหรับ websocket disconnect และ upstream failure
- ย้าย CORS origin และ deployment-specific settings ไปไว้ใน env/config ให้ครบ
- เพิ่ม observability เช่น structured logs, metrics, health endpoints และ tracing
- เก็บ market data snapshots และ event history ให้ richer ขึ้นสำหรับ replay / analytics
- เพิ่ม websocket scoping ให้ละเอียดระดับ widget หรือ symbol มากขึ้น
- เพิ่ม expandable table rows และ order-detail presentation

## Submission Notes
submission นี้ประกอบด้วย:
- source code ของ frontend และ backend
- database schema และ seed data
- automated tests ทั้ง backend, frontend และ browser-level flows
- deployment placeholders ใน README นี้สำหรับแทนลิงก์ที่ใช้งานจริง
- documentation ด้าน architecture, trade-offs และ runtime behavior

ปัจจุบันยังไม่มี Swagger หรือ Postman asset ใน repo และ API surface ถูกสรุปไว้ใน README นี้แทน

## Manual replacement checklist
- แทน `<REPLACE_WITH_FRONTEND_URL>` ด้วย deployed frontend URL จริง
- แทน `<REPLACE_WITH_BACKEND_URL>` ด้วย deployed backend URL จริง
- ตัดสินใจว่าจะมี API docs URL จริงหรือคง `N/A`
- ตรวจสอบชื่อ env variable ใน production ว่าตรงกับตัวอย่างหรือไม่
- ปรับ run commands หาก submission สุดท้ายใช้ package manager หรือ deployment script แตกต่างจากในตัวอย่าง
