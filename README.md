# NanoDashboard

NanoDashboard is a take-home assignment implementation of a trading-style dashboard with a React frontend and a NestJS backend. The project focuses on two things: a customizable widget-driven UI on the client side, and a backend that aggregates authenticated user data, cached market data, and realtime event streams into a single dashboard-oriented contract.

The implementation is intentionally closer to a modular product slice than a set of isolated demos. The frontend supports drag, resize, widget composition, chart rendering, table column resizing, and realtime updates. The backend provides JWT-based authentication, user CRUD, Binance REST and WebSocket integration, Redis-backed caching, websocket broadcasting, and an aggregated dashboard endpoint with timeout and fallback behavior.

This is not presented as a fully production-hardened trading platform. Some parts are production-like, especially the service separation, cache strategy, validation, and degraded-state handling. Some parts remain assignment-oriented, especially demo-seeded order/PNL data and the limited operational surface around deployment, observability, and long-term market data persistence.

## Live Demo
- Frontend URL: `<REPLACE_WITH_FRONTEND_URL>`
- Backend URL: `<REPLACE_WITH_BACKEND_URL>`
- API docs URL: `N/A - Swagger/OpenAPI is not currently exposed; see API Summary below`

## Overview
This project solves the assignment as a fullstack dashboard rather than as independent API and UI exercises. The frontend is designed around a configurable workspace where widgets can be moved, resized, reset, and updated in place. The backend is designed around a single dashboard consumption model: instead of exposing raw external payloads to the UI, it aggregates and normalizes data into a dashboard-specific response contract.

That separation is important for reviewer evaluation. The frontend does not need to understand Binance payload shapes, retry semantics, or cache keys. The backend absorbs that complexity and exposes a stable `/api/dashboard/summary` contract, while websocket updates deliver targeted incremental changes for BTC price, BTC volume, and user events. This keeps the client focused on rendering and interaction, and keeps external API volatility behind the server boundary.

## Assignment Coverage
### Frontend Requirements
- Drag / Resize / Arrange
  - Status: Done
  - Implementation: The dashboard uses a custom layout engine under `web/src/features/dashboard/lib` plus pointer-driven hooks such as `useWidgetDrag`, `useWidgetResize`, and the layout controller in `useDashboardLayoutController`. Widgets are not positioned in a fixed hardcoded grid; panel coordinates and dimensions are calculated and persisted through the dashboard layout system.
  - Notes: The implementation is custom rather than relying entirely on an off-the-shelf dashboard package. This gave tighter control over collision handling, docking/minimize/maximize states, and resize constraints, at the cost of more layout logic in the codebase.

- 4 Chart Types
  - Status: Done
  - Implementation: The chart system supports line, bar, column, and pie variants through a shared widget composition layer in `dashboardDefinition.ts` and chart rendering utilities under `web/src/features/chart`. The current dashboard uses BTC trend, volume profile, daily PNL, and market share breakdown widgets.
  - Notes: ApexCharts is used as the rendering layer, while the app-specific chart model and options remain internal to the project.

- Table: Resizable Columns / Expandable Rows
  - Status: Partial
  - Implementation: The open orders table supports resizable columns through `useColumnResize`, persistent widths, sticky headers, and widget-contained scrolling. Column width state is stored and reused across sessions.
  - Notes: Expandable rows are not currently implemented. I chose to complete column resizing and table responsiveness first because they had stronger impact on dashboard usability inside constrained widget space.

- getDateRange Utility
  - Status: Done
  - Implementation: `web/src/shared/utils/dateRange.ts` parses date input safely and returns normalized UTC `start` / `end` pairs for `day`, `week`, `month`, and `year`.
  - Notes: The utility is intentionally isolated from widget rendering so date-range logic can be tested independently.

- Realtime UI Updates
  - Status: Done
  - Implementation: `useDashboardSocket` manages websocket connection lifecycle, message parsing, reconnect backoff, and safe callback dispatch for BTC price, BTC volume, and user events. The dashboard applies websocket updates incrementally to existing widget state instead of refetching the whole page.
  - Notes: Listener references are stored in refs to avoid stale closures and duplicate re-subscription patterns.

### Backend Requirements
- Users CRUD + JWT
  - Status: Done
  - Implementation: `AuthController` provides register, login, and authenticated `me`; `UsersController` provides admin-scoped list, get-by-id, update, and delete operations. Guards combine JWT validation with role checks for admin-only routes.
  - Notes: Access token issuance is implemented with JWT and a 15-minute expiry. There is no refresh-token flow in this assignment.

- WebSocket: `user.created` / `user.updated`
  - Status: Done
  - Implementation: `EventsGateway` exposes a pure WebSocket endpoint on `/ws`, authenticates clients via bearer token or query token, and broadcasts scoped domain events. `AuthService` emits `user.created`, and user update flows emit `user.updated`.
  - Notes: Admin clients receive broader user event visibility; authenticated users also receive room-scoped updates for their own user room.

- Binance REST + WebSocket
  - Status: Done
  - Implementation: `BinanceService` fetches ticker and kline data over REST with retry and timeout controls. `BtcPriceLiveService` and `BtcVolumeLiveService` connect to Binance websocket streams for incremental BTC updates.
  - Notes: The live stream scope is intentionally narrow in this assignment: BTC price plus volume-profile timeframes, not a full exchange-wide stream topology.

- Redis Cache
  - Status: Done
  - Implementation: `RedisService` provides typed get/set/delete/pattern-delete helpers and graceful degradation when Redis is unavailable. `DashboardService` uses hot and stale cache keys with separate TTLs.
  - Notes: Current dashboard cache TTLs are 30 seconds for hot cache and 300 seconds for stale fallback cache.

- GET `/dashboard`
  - Status: Done
  - Implementation: Implemented as `GET /api/dashboard/summary`, which is the assignment-equivalent aggregated dashboard endpoint. It returns normalized dashboard data rather than raw upstream payloads.
  - Notes: The route name is `summary` rather than exactly `/dashboard`, but it fulfills the same aggregation role.

- Internal API Layer
  - Status: Done
  - Implementation: `InternalService` provides internal health composition for DB, Redis, and websocket connection count. The dashboard summary uses that service rather than coupling directly to infrastructure checks in the controller.
  - Notes: This internal service layer is intentionally narrow but demonstrates the pattern for non-public internal orchestration.

- Database Design
  - Status: Done
  - Implementation: Prisma schema includes `User`, `Order`, `CryptoPrice`, and `PriceHistory`, with indexes aligned to query patterns such as symbol lookups, time-based history access, and user/order filtering.
  - Notes: The schema is enough for assignment scope, but full production trading systems would require stronger event-sourcing and audit characteristics.

- Architecture Decision
  - Status: Done
  - Implementation: The system is implemented as a modular monolith with feature modules and service boundaries, rather than as microservices.
  - Notes: The rationale is documented below under Architecture Decision.

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
  - Fastify adapter for NestJS HTTP serving
  - Native WebSocket gateway via `ws`
  - JWT authentication
  - Prisma ORM

- Data / Infra
  - PostgreSQL
  - Redis
  - Binance REST API
  - Binance WebSocket streams

- Testing
  - Jest for backend unit/integration/e2e coverage
  - Vitest + Testing Library for frontend unit/integration coverage
  - Playwright for browser-level frontend e2e

## Why This Stack
React + TypeScript was the most practical frontend choice for this assignment because the UI is interaction-heavy rather than content-heavy. Dragging, resizing, panel collision resolution, table resizing, websocket-driven state updates, and multiple widget types all benefit from component composition, explicit state transitions, and strong type boundaries. Tailwind was chosen to move quickly on a custom dashboard surface without introducing a large design system dependency. ApexCharts provided the required chart types while still allowing the application to own chart configuration and state mapping internally.

NestJS / Node.js was selected instead of FastAPI because the assignment is realtime-oriented on both sides of the stack. The backend needs REST endpoints, JWT guards, websocket event broadcasting, service/module boundaries, and external websocket consumers. NestJS provides those concerns in one framework with strong structure for controllers, providers, guards, modules, and testing. FastAPI would also have been a valid choice, especially for REST-heavy service design, but it would not have reduced total complexity for this assignment because the project still needed websocket handling, typed service orchestration, and modular separation. Keeping both frontend and backend in TypeScript also reduces context switching and makes DTO, event, and payload reasoning more consistent across the stack.

Prisma was chosen because the assignment benefits from readable schema management and clear data access code more than from low-level SQL tuning. It made it easier to define user/order/price history models, index intent, and seed demo data with less ceremony. Redis was chosen because the dashboard workload is aggregation-oriented and partially upstream-dependent. That makes cache-as-shield behavior useful: Redis reduces repeated Binance calls for the same dashboard snapshot and provides stale fallback data when upstream or internal sections fail.

## Architecture Decision
The project uses a modular monolith because that is the most appropriate architecture for a take-home assignment of this size. The assignment needs enough structure to demonstrate service boundaries, separation of concerns, and future scalability, but not the operational overhead of deploying, coordinating, and observing multiple services.

In a microservices design, user management, market data ingestion, dashboard aggregation, and websocket broadcasting could reasonably become separate deployables. That approach makes more sense when teams, scaling characteristics, or fault domains are independent enough to justify separate build, deployment, and runtime boundaries. In this assignment, that would have introduced complexity in service discovery, event transport, cross-service auth, and deployment orchestration without creating proportionate review value.

A modular monolith keeps the code review surface focused on engineering choices rather than infrastructure ceremony. Nest modules such as `auth`, `users`, `market-data`, `dashboard`, `events`, `orders`, and `pnl` already enforce useful boundaries. The internal service layer reduces direct coupling between features, so future extraction remains possible. If this system had to scale further, the first extraction candidate would likely be market data ingestion and caching, because it has the most distinct reliability profile, external dependency sensitivity, and realtime behavior. The current design keeps that path open without paying microservice overhead up front.

## Frontend Implementation
### Dashboard layout engine
The dashboard layout is driven by application-defined panel geometry rather than a fixed marketing-grid layout. The layout modules under `web/src/features/dashboard/lib` resolve panel positions, row alignment, resizing consequences, collision behavior, and default restoration. This is what allows the dashboard to behave like a workspace instead of a static page.

### Drag and resize behavior
Dragging and resizing are handled with pointer-event hooks such as `useWidgetDrag` and the associated resize hooks. Pointer capture is used to keep interactions stable, and panel changes are coordinated through the dashboard layout controller rather than directly mutating visual styles ad hoc. This keeps drag/resize behavior deterministic and testable.

### Widget composition
Widget composition is centralized in `createTradingDashboardDefinition`. The page container passes normalized summary data into widget factories for line charts, bar charts, column charts, pie charts, and the open-orders table. This prevents individual widgets from depending directly on raw API contracts or external payload shapes.

That abstraction is one of the main reasons the frontend does not depend directly on Binance structure. The server already exposes a dashboard-specific DTO, and the client maps that DTO into widget-specific presentation models. If Binance fields change, the intended place to absorb that change is the backend and the dashboard service normalization layer, not widget rendering components.

### Chart implementation
Charts are implemented with ApexCharts but controlled through internal chart models and option builders. Each chart variant has its own presentation metadata but shares a common widget shell. The current set covers:
- BTC price trend: line chart
- Market share breakdown: pie chart
- Volume profile: bar chart
- Daily PNL: column chart

### Table implementation
The open orders table is implemented as a widget-scoped table with sticky headers, resizable columns, per-column width persistence, and dashboard-friendly overflow handling. It is intentionally designed to work inside a resizable widget rather than assuming a full-page table layout. Expandable rows are not implemented in the current version.

### getDateRange utility
`getDateRange` is implemented as a small isolated utility that accepts an input date and a range type (`day`, `week`, `month`, `year`) and returns normalized UTC boundaries. It is independently testable and avoids mixing date arithmetic into widget rendering code.

### Realtime UI updates
The frontend connects to `/ws` through `useDashboardSocket`. The hook handles:
- building the websocket URL from `VITE_API_BASE_URL`
- passing the JWT as a query token for authenticated sockets
- reconnecting with exponential backoff
- closing and cleaning up sockets when the dashboard is disabled or unmounted
- storing latest callbacks in refs to avoid duplicate listener issues and stale closure bugs

This is the main answer to how duplicate listener issues are avoided on the client. The hook owns one socket instance, cleans up previous handlers during teardown, and keeps callback references current without repeatedly attaching new listeners for each render.

## Backend Implementation
### Auth and JWT
Authentication is implemented in `auth`. Registration hashes passwords with bcrypt, login returns a JWT access token, and authenticated routes use JWT guards. Role-based authorization is implemented for admin-only user routes.

### Users CRUD
The `users` module exposes:
- `GET /api/users`
- `GET /api/users/me`
- `GET /api/users/:id`
- `PATCH /api/users/:id`
- `DELETE /api/users/:id`

The list, get-by-id, update, and delete flows are admin-protected. `me` is available to any authenticated user.

### WebSocket events
`EventsGateway` uses a pure WebSocket endpoint at `/ws`. It authenticates optional JWT-bearing clients, maintains connection counts, supports scoped room-style delivery for authenticated users, and broadcasts:
- `user.created`
- `user.updated`
- `btc.price.updated`
- `btc.volume.updated`
- ticker events as needed

### Binance REST integration
`BinanceService` is the REST integration boundary. It applies:
- 5 second request timeout
- up to 4 attempts
- retry behavior for retryable network failures and retryable HTTP statuses (`429`, `502`, `503`, `504`)
- no retry for explicitly non-retryable statuses such as `400`, `403`, and `418`

### Binance realtime stream handling
Realtime BTC updates are handled by `BtcPriceLiveService` and `BtcVolumeLiveService`. These services connect to Binance streams, parse only the fields needed by the dashboard contract, avoid rebroadcasting duplicate events by signature comparison, and reconnect with exponential backoff when the upstream stream closes.

### Aggregated `/dashboard` endpoint
The main aggregation endpoint is `GET /api/dashboard/summary`. It composes:
- active user count
- top movers
- market overview
- market share
- BTC price trend
- BTC volume profile
- daily PNL
- open orders
- internal health summary

This endpoint exists so the frontend can fetch a single dashboard contract instead of coordinating many independent API calls.

### Cache strategy
The dashboard summary uses Redis-backed caching with two tiers:
- hot cache: 30 seconds
- stale cache: 300 seconds

The hot cache reduces repeated recomputation and limits upstream REST calls for frequent dashboard refreshes. The stale cache is used as a degraded fallback when the live build path fails.

This is how the cache strategy reduces Binance calls in practice. Without the dashboard cache, every summary refresh would trigger tracked ticker, BTC trend, and volume-profile upstream work. With cache, repeated reads within the hot TTL are served from Redis. Even when the live build fails, the stale cache can serve the previous assembled snapshot instead of triggering user-visible failure and a new immediate round of external fetches.

### Internal API/service layer
`InternalService` provides health composition for:
- database connectivity
- Redis availability
- websocket connection count

That internal service is intentionally separated so the dashboard service does not perform infrastructure checks inline. It also demonstrates how internal-only service logic can be encapsulated and later extracted if the system grows.

### Error handling / timeout / retry / fallback
The backend uses multiple defensive layers:
- Binance REST calls retry on retryable failure types
- dashboard section calls are wrapped with a 7 second timeout
- section-level failures degrade to fallback data where possible
- dashboard summary writes both hot and stale caches after successful builds
- stale cache is returned when live build fails after at least one previous successful snapshot

When Binance fails or responds slowly, the behavior depends on which path is affected. REST fetches may retry first. If a dashboard subsection still fails or times out, that section falls back to an empty or default payload and contributes a warning. If the overall summary build fails after that, stale cached summary data is returned when available. This keeps the UI usable even in degraded upstream states.

## Data Flow
The end-to-end flow is:

Binance REST / Binance WebSocket  
→ `BinanceService`, `BtcPriceLiveService`, `BtcVolumeLiveService`  
→ market-data normalization and dashboard composition services  
→ Redis hot/stale cache and PostgreSQL-backed domain data where relevant  
→ `GET /api/dashboard/summary` for initial dashboard hydration  
→ frontend summary normalization and widget composition  
→ websocket incremental updates applied directly into live widget state

The key design choice is that the frontend consumes dashboard-specific data, not external exchange-specific contracts. That reduces direct UI coupling to external API structure and centralizes contract normalization in the backend.

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
└─ README.md
```

Important areas:
- `api/src/dashboard`: dashboard aggregation, cache policy, fallback behavior
- `api/src/market-data`: Binance-driven market data snapshots plus BTC live stream services
- `api/src/events`: websocket gateway and event publisher/provider contracts
- `web/src/features/dashboard`: layout engine, drag/resize hooks, workspace composition
- `web/src/features/chart`: chart rendering model and variant-specific presentation
- `web/src/features/table`: resizable open-orders table

## Setup Instructions
### Prerequisites
- Node.js 20+ recommended
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
Create `api/.env`:

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
Create `web/.env`:

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

This seeds:
- a demo admin user
- sample crypto prices / price history
- demo orders for the seeded admin path

### 6. Start backend
```bash
cd api
npm run start:dev
```

The backend runs on:
- `http://localhost:3000`
- websocket path: `ws://localhost:3000/ws`

### 7. Start frontend
```bash
cd web
npm run dev
```

The frontend runs on:
- `http://localhost:5173`

## Environment Variables
| Variable | Example | Used by current code | Purpose |
|---|---|---:|---|
| `DATABASE_URL` | `postgresql://user:password@localhost:5432/nanodashboard` | Yes | Prisma/PostgreSQL connection |
| `REDIS_URL` | `redis://localhost:6379` | Yes | Redis cache connection |
| `JWT_SECRET` | `<secure-secret>` | Yes | JWT signing and verification |
| `BINANCE_BASE_URL` | `https://api.binance.com` | Yes | Binance REST base URL |
| `BINANCE_WS_BASE_URL` | `wss://stream.binance.com:9443/ws` | Yes | Binance websocket base URL |
| `BINANCE_LIVE_STREAM_ENABLED` | `true` | Yes | Enables/disables backend BTC live stream consumers |
| `PORT` | `3000` | Yes | Backend HTTP port |
| `VITE_API_BASE_URL` | `http://localhost:3000` | Yes | Frontend REST + websocket base origin |
| `FRONTEND_URL` | `http://localhost:5173` | No, recommended | Typical production CORS origin variable; current code hardcodes localhost origin in `main.ts` |
| `NODE_ENV` | `development` | Implicitly | Affects some runtime/test-only behaviors |

## Testing
The project includes multiple testing layers.

- Backend unit/integration tests
  - Focus: service logic, fallback behavior, Binance integration behavior, dashboard aggregation
  - Command:
```bash
cd api
npm test
```

- Backend e2e tests
  - Focus: Nest HTTP routes and end-to-end API behavior
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

There is also browser-level realtime proof in the application itself through websocket-driven BTC updates and user event handling, plus targeted integration coverage such as `DashboardPage.realtime.integration.test.tsx` and `useDashboardSocket.test.tsx`.

## API Summary
Important HTTP endpoints currently implemented:

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
  - Events include: `user.created`, `user.updated`, `btc.price.updated`, `btc.volume.updated`

Swagger/OpenAPI is not currently exposed. There is also no Postman collection committed in the current repository.

## Performance and Reliability
The main reliability mechanisms are pragmatic rather than fully infrastructure-heavy.

- Cache hit/miss behavior
  - Dashboard reads attempt hot cache first, then stale cache, then live build.
  - Successful builds repopulate both hot and stale caches.

- TTL
  - Hot cache: 30 seconds
  - Stale cache: 300 seconds

- Retry logic
  - Binance REST retries up to 4 attempts for retryable errors.

- Timeout behavior
  - Dashboard subsections are wrapped in a 7 second timeout to prevent a single dependency from hanging the entire summary build.

- Fallback/stale data strategy
  - Subsections such as BTC trend, volume profile, PNL, open orders, and market overview can degrade to fallback payloads.
  - If a fresh build still fails at the summary level, stale cache is returned when available.

- Reconnect behavior
  - Backend BTC live stream consumers reconnect to Binance with exponential backoff.
  - Frontend websocket reconnects with exponential backoff and cleans up prior socket handlers before reconnecting.

No hard latency or throughput numbers are claimed here because they were not formally benchmarked.

## Challenges and Solutions
- WebSocket reconnect and listener lifecycle
  - Solution: centralized websocket ownership in `useDashboardSocket`, explicit cleanup, callback refs to prevent stale closures and duplicate listener attachment.

- Upstream Binance instability
  - Solution: REST retry policy, section-level timeouts, fallback payloads, and stale-cache return path.

- Preventing the frontend from depending on external API structure
  - Solution: backend dashboard DTOs and frontend widget composition layer. Binance payloads are normalized server-side and then remapped client-side into widget models.

- Dashboard layout collision and resize behavior
  - Solution: dedicated dashboard layout resolution logic instead of hardcoded CSS positioning.

- Avoiding cache corruption from partial legacy payloads
  - Solution: cache parse guards that invalidate incomplete dashboard cache entries and force rebuild.

- Realtime stream noise / duplicate update payloads
  - Solution: signature-based duplicate suppression in BTC live stream services before rebroadcasting.

## Trade-offs / Known Limitations
- Open orders and daily PNL are partly demo-oriented today. For the seeded demo admin user, those widgets are backed by seeded data rather than live brokerage data.
- The dashboard is production-like in structure, but not fully production-grade in observability. There is logging, but not full metrics, tracing, alerting, or structured operational dashboards.
- CORS configuration is currently hardcoded to localhost in `main.ts`; a production deployment should externalize that into configuration.
- There is no refresh-token flow or long-lived session management.
- Table row expansion is not implemented.
- Market data persistence is present in schema and seed structure, but the current assignment emphasizes dashboard consumption and live updates more than long-term analytics storage.

## Future Improvements
- Add browser-level degraded-state e2e coverage for websocket disconnect and upstream failure scenarios
- Move CORS origin and deployment-specific settings fully into environment configuration
- Add stronger observability: structured logs, metrics, health endpoints, and tracing
- Persist richer market data snapshots and event history for replay or analytics
- Add finer websocket scoping and subscriptions for per-widget or per-symbol delivery
- Implement expandable table rows and richer order-detail presentation

## Submission Notes
This submission includes:
- source code for frontend and backend
- database schema and seed data
- automated tests across backend, frontend, and browser-level flows
- deployment placeholders in this README for frontend/backend review links
- documentation of architecture, trade-offs, and runtime behavior

There is no Swagger or Postman asset committed at the moment. The API surface is documented in this README instead.

## Manual replacement checklist
- Replace `<REPLACE_WITH_FRONTEND_URL>` with the deployed frontend URL
- Replace `<REPLACE_WITH_BACKEND_URL>` with the deployed backend URL
- Confirm whether you want to expose a real API docs URL or keep `N/A`
- Verify the exact production env variable names if they differ from the examples above
- Update local setup commands if your final submission uses different package manager commands or deployment scripts
