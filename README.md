# NanoDashboard

NanoDashboard is a fullstack trading-style dashboard with a React frontend and a NestJS backend. The backend owns authentication, user management, Redis-backed caching, Binance integration, websocket broadcasting, and dashboard aggregation. The frontend focuses on rendering an interactive workspace with charts, tables, and realtime updates.

## Quick Links

- Frontend app: `https://nano-dashboard-pi.vercel.app`
- Backend API: `https://dynamic-embrace-production.up.railway.app`
- Backend Swagger UI: `<BACKEND_URL>/api/docs`
- Backend OpenAPI JSON: `<BACKEND_URL>/api/docs-json`
- Backend README: [api/README.md](/c:/Users/User/Desktop/nanodashboard/api/README.md)
- Postman collection: [NanoDashboard.postman_collection.json](/c:/Users/User/Desktop/nanodashboard/api/postman/NanoDashboard.postman_collection.json)
- Thai overview: [README.th.md](/c:/Users/User/Desktop/nanodashboard/README.th.md)

## Repo Structure

```text
nanodashboard/
├─ api/   # NestJS backend
├─ web/   # React frontend
└─ docker-compose.yml   # Local Postgres + Redis
```

## What Is Implemented

- JWT auth with register, login, refresh, and authenticated profile endpoints
- User management with protected list, detail, update, and soft delete flows
- Socket.IO gateways for user events and market/dashboard realtime events
- Binance REST and websocket integration with retry, reconnect, cache, and fallback behavior
- Redis cache for market prices and aggregated dashboard responses
- Aggregated dashboard endpoints for frontend consumption
- Swagger/OpenAPI docs and a Postman collection with example requests and responses
- Automated tests across backend and frontend business logic

## Running The Project

### Infrastructure

```bash
docker-compose up -d
```

This starts:

- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`

### Backend

```bash
cd api
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run db:seed
npm run start:dev
```

### Frontend

```bash
cd web
npm install
npm run dev
```

## Documentation

The backend README contains the submission-oriented documentation:

- environment variables
- local and Docker-based setup
- tech stack decision and trade-offs
- architecture choice and scaling discussion
- database schema explanation
- common problems and mitigations
- API summary table

Read it here: [api/README.md](/c:/Users/User/Desktop/nanodashboard/api/README.md)

## Review Notes

- Swagger is exposed at `/api/docs`
- OpenAPI JSON is exposed at `/api/docs-json`
- The Postman collection includes auth, users, market data, and dashboard requests
- Binance websocket availability can vary by cloud provider or region, so the backend includes reconnect, logging, and fallback behavior to keep the dashboard usable when upstream live streams fail

## Submission Checklist

- Replace placeholder deployment URLs if they change
- Confirm production environment variables on the deployed backend
- Verify Swagger and Postman examples against the final deployed build
