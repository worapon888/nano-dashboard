# Refined architecture diagrams — Mermaid source

These Mermaid diagrams correspond to the three SVG visuals rendered in the conversation.
Paste any of them into mermaid.live, GitHub markdown, or Notion to render.

---

## Diagram 1: Layered architecture overview

```mermaid
graph TB
    subgraph CLIENTS["Clients"]
        C1[REST Client]
        C2[WS Client]
        C3[Admin Client]
    end

    subgraph API["API Layer — Controllers + Guards"]
        AuthCtrl[Auth Controller<br/><small>JWT guards, validation</small>]
        UserCtrl[User Controller<br/><small>Profile CRUD</small>]
        MarketCtrl[MarketData Controller<br/><small>Ticker, orderbook, trades</small>]
        DashCtrl[Dashboard Controller<br/><small>Aggregation views</small>]
    end

    subgraph APP["Application Layer — Domain Services"]
        AuthSvc[AuthService<br/><small>Token lifecycle, argon2</small>]
        UserSvc[UserService<br/><small>User domain logic</small>]
        MarketSvc[MarketDataService<br/><small>Cache-first reads</small>]
        DashSvc[DashboardService<br/><small>Compose + merge</small>]
    end

    subgraph INTEG["Integration Layer — Adapters"]
        InternalSvc[InternalService<br/><small>Health, probes</small>]
        BinanceSvc[BinanceService<br/><small>REST + WS adapter</small>]
        WSGateway[WebSocket Gateway<br/><small>Rooms, broadcast</small>]
    end

    subgraph INFRA["Infrastructure Layer"]
        PG[(PostgreSQL<br/>Prisma ORM)]
        Redis[(Redis<br/>Cache + Pub/Sub)]
        BinanceAPI{{Binance API<br/>External boundary}}
    end

    C1 & C3 --> AuthCtrl & UserCtrl & MarketCtrl & DashCtrl
    C2 -.->|WS upgrade| WSGateway

    AuthCtrl --> AuthSvc
    UserCtrl --> UserSvc
    MarketCtrl --> MarketSvc
    DashCtrl --> DashSvc

    AuthSvc --> UserSvc
    AuthSvc --> PG
    UserSvc --> PG
    MarketSvc -->|cache miss| BinanceSvc
    MarketSvc -->|read/write| Redis
    MarketSvc -->|broadcast| WSGateway
    DashSvc --> UserSvc & MarketSvc & InternalSvc

    BinanceSvc --> BinanceAPI
    InternalSvc --> PG & Redis
    WSGateway -.->|push events| C2

    style CLIENTS fill:transparent,stroke:#888
    style API fill:transparent,stroke:#534AB7
    style APP fill:transparent,stroke:#0F6E56
    style INTEG fill:transparent,stroke:#D85A30
    style INFRA fill:transparent,stroke:#888
    style BinanceAPI fill:#FBEAF0,stroke:#993556
```

---

## Diagram 2: Market data flow (cache hit/miss + realtime)

```mermaid
graph TB
    REQ["GET /market/ticker/BTCUSDT"] -->|1. Request| MS[MarketDataService]
    MS -->|2. Check cache| REDIS[(Redis<br/>ticker:BTCUSDT<br/>TTL 2s)]

    REDIS -->|3a. Cache HIT| MS
    MS -->|3b. Cache MISS| BS[BinanceService<br/><small>retry 3x, timeout 5s</small>]
    BS -->|4. HTTP GET| BAPI{{Binance REST API}}
    BAPI -->|5. Response| BS
    BS -->|6. Normalize DTO| MS
    MS -->|7. SETEX TTL=2| REDIS

    subgraph REALTIME["Parallel: Realtime streaming path"]
        BWS{{Binance WS Stream}} -->|tick event| MS2[MarketDataService]
        MS2 -->|update cache| REDIS2[(Redis)]
        MS2 -->|emit to room| WSG[WS Gateway]
        WSG -->|ticker:update| CLIENT[Subscribed clients<br/><small>room: ticker:BTCUSDT</small>]
    end

    style BAPI fill:#FBEAF0,stroke:#993556
    style BWS fill:#FBEAF0,stroke:#993556
    style REALTIME fill:transparent,stroke:#0F6E56,stroke-dasharray:4
```

---

## Diagram 3: WebSocket subscription + Dashboard aggregation

```mermaid
graph TB
    subgraph WS_FLOW["WebSocket subscription lifecycle"]
        WC[WS Client] -->|1. Upgrade ?token=JWT| AG[Auth Guard]
        AG -->|2. Validate| WSG[WS Gateway]
        WSG -->|3. Register connection| RM[Room Manager]
        WC -->|4. subscribe ticker:BTCUSDT| RM
        RM -->|5. Join room| ROOMS["Rooms<br/><small>ticker:BTCUSDT<br/>orderbook:ETHUSDT</small>"]
        MDS[MarketService] -->|6. emit ticker:update| WSG
        WSG -->|7. Broadcast to room| WC
    end

    subgraph DASH_FLOW["Dashboard aggregation"]
        DC[DashboardService] -->|Promise.all| US[UserService]
        DC -->|Promise.all| MKT[MarketService]
        DC -->|Promise.all| IS[InternalService]
        US -->|COUNT users| PG[(PostgreSQL)]
        MKT -->|top movers| REDIS[(Redis TTL 10s)]
        IS -->|ping| PG
        IS -->|ping| REDIS
        DC -->|cache result| REDIS_DASH[(Redis<br/>dashboard:summary<br/>TTL 30s)]
    end

    style WS_FLOW fill:transparent,stroke:#0F6E56,stroke-dasharray:4
    style DASH_FLOW fill:transparent,stroke:#534AB7,stroke-dasharray:4
```
