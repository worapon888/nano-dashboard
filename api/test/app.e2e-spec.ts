import { ValidationPipe, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { WsAdapter } from '@nestjs/platform-ws';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import WebSocket, { RawData } from 'ws';
import { AppModule } from '../src/app.module';
import { AuthModule } from '../src/auth/auth.module';
import {
  BinanceService,
  BinanceUnavailableException,
} from '../src/binance/binance.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import type { CurrentUserPayload } from '../src/auth/interfaces/current-user-payload.interface';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { MarketDataService } from '../src/market-data/market-data.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { UsersModule } from '../src/users/users.module';

type MockUser = {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type MockOrder = {
  id: string;
  userId: string;
  pair: string;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET' | 'STOP' | 'TAKE_PROFIT';
  price: string;
  amount: string;
  filledPercent: string;
  totalUsd: string;
  status: 'OPEN' | 'PARTIAL' | 'FILLED' | 'CANCELLED';
  createdAt: Date;
  updatedAt: Date;
};

const adminId = '11111111-1111-1111-1111-111111111111';
const userId = '22222222-2222-2222-2222-222222222222';
const deletedUserId = '33333333-3333-3333-3333-333333333333';

const createUsers = (): MockUser[] => [
  {
    id: adminId,
    email: 'admin@example.com',
    passwordHash: 'hashed-admin-password',
    displayName: 'Admin User',
    role: UserRole.ADMIN,
    isActive: true,
    createdAt: new Date('2026-03-30T10:00:00.000Z'),
    updatedAt: new Date('2026-03-30T10:00:00.000Z'),
    deletedAt: null,
  },
  {
    id: userId,
    email: 'user@example.com',
    passwordHash: 'hashed-user-password',
    displayName: 'Standard User',
    role: UserRole.USER,
    isActive: true,
    createdAt: new Date('2026-03-30T11:00:00.000Z'),
    updatedAt: new Date('2026-03-30T11:00:00.000Z'),
    deletedAt: null,
  },
  {
    id: deletedUserId,
    email: 'deleted@example.com',
    passwordHash: 'hashed-deleted-password',
    displayName: 'Deleted User',
    role: UserRole.USER,
    isActive: false,
    createdAt: new Date('2026-03-29T11:00:00.000Z'),
    updatedAt: new Date('2026-03-29T11:00:00.000Z'),
    deletedAt: new Date('2026-03-30T12:00:00.000Z'),
  },
];

const createOrders = (): MockOrder[] => [
  {
    id: 'demo-order-1',
    userId: adminId,
    pair: 'BTC/USDT',
    side: 'BUY',
    type: 'LIMIT',
    price: '67500',
    amount: '0.15',
    filledPercent: '0',
    totalUsd: '10125',
    status: 'OPEN',
    createdAt: new Date('2026-01-15T16:23:00.000Z'),
    updatedAt: new Date('2026-01-15T18:45:00.000Z'),
  },
  {
    id: 'demo-order-2',
    userId: adminId,
    pair: 'ETH/USDT',
    side: 'SELL',
    type: 'LIMIT',
    price: '3480',
    amount: '2.5',
    filledPercent: '48',
    totalUsd: '8700',
    status: 'PARTIAL',
    createdAt: new Date('2026-01-15T17:14:00.000Z'),
    updatedAt: new Date('2026-01-15T18:45:00.000Z'),
  },
];

const authPayloads: Record<string, CurrentUserPayload> = {
  'admin-token': {
    sub: adminId,
    email: 'admin@example.com',
    role: UserRole.ADMIN,
  },
  'user-token': {
    sub: userId,
    email: 'user@example.com',
    role: UserRole.USER,
  },
  'deleted-token': {
    sub: deletedUserId,
    email: 'deleted@example.com',
    role: UserRole.USER,
  },
};

const applyUserSelect = (
  user: MockUser,
  select?: Record<string, boolean>,
): Record<string, unknown> => {
  if (!select) {
    return { ...user };
  }

  return Object.entries(select).reduce<Record<string, unknown>>(
    (accumulator, [key, enabled]) => {
      if (enabled) {
        accumulator[key] = user[key as keyof MockUser];
      }

      return accumulator;
    },
    {},
  );
};

const matchesWhere = (user: MockUser, where?: Record<string, any>): boolean => {
  if (!where) {
    return true;
  }

  if (where.deletedAt === null && user.deletedAt !== null) {
    return false;
  }

  if (where.id && user.id !== where.id) {
    return false;
  }

  if (where.email && typeof where.email === 'string' && user.email !== where.email) {
    return false;
  }

  if (
    where.isActive !== undefined &&
    typeof where.isActive === 'boolean' &&
    user.isActive !== where.isActive
  ) {
    return false;
  }

  if (Array.isArray(where.OR) && where.OR.length > 0) {
    const matchesAny = where.OR.some((condition) => {
      if (condition.email?.contains) {
        return user.email
          .toLowerCase()
          .includes(String(condition.email.contains).toLowerCase());
      }

      if (condition.displayName?.contains) {
        return user.displayName
          .toLowerCase()
          .includes(String(condition.displayName.contains).toLowerCase());
      }

      return false;
    });

    if (!matchesAny) {
      return false;
    }
  }

  return true;
};

const createPrismaMock = (users: MockUser[], orders: MockOrder[] = []) => ({
  user: {
    findMany: jest.fn(async (args?: Record<string, any>) => {
      const filteredUsers = users
        .filter((user) => matchesWhere(user, args?.where))
        .sort(
          (left, right) =>
            right.createdAt.getTime() - left.createdAt.getTime(),
        );

      const paginatedUsers = filteredUsers.slice(
        args?.skip ?? 0,
        (args?.skip ?? 0) + (args?.take ?? filteredUsers.length),
      );

      return paginatedUsers.map((user) => applyUserSelect(user, args?.select));
    }),
    count: jest.fn(async (args?: Record<string, any>) => {
      return users.filter((user) => matchesWhere(user, args?.where)).length;
    }),
    findFirst: jest.fn(async (args?: Record<string, any>) => {
      const user = users.find((entry) => matchesWhere(entry, args?.where));
      return user ? applyUserSelect(user, args?.select) : null;
    }),
    findUnique: jest.fn(async (args?: Record<string, any>) => {
      const where = args?.where;
      const user = users.find((entry) => matchesWhere(entry, where));
      return user ? applyUserSelect(user, args?.select) : null;
    }),
    create: jest.fn(async (args: Record<string, any>) => {
      const now = new Date('2026-03-30T14:00:00.000Z');
      const createdUser: MockUser = {
        id: '44444444-4444-4444-4444-444444444444',
        email: args.data.email,
        passwordHash: args.data.passwordHash,
        displayName: args.data.displayName,
        role: args.data.role,
        isActive: args.data.isActive,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };

      users.push(createdUser);

      return applyUserSelect(createdUser, args.select);
    }),
    update: jest.fn(async (args: Record<string, any>) => {
      const user = users.find((entry) => entry.id === args.where.id);

      if (!user) {
        throw new Error('User not found');
      }

      Object.assign(user, args.data, {
        updatedAt: new Date('2026-03-30T13:00:00.000Z'),
      });

      return applyUserSelect(user, args.select);
    }),
  },
  order: {
    findMany: jest.fn(async (args?: Record<string, any>) => {
      const filteredOrders = orders
        .filter((order) => {
          if (!args?.where) {
            return true;
          }

          if (args.where.userId && order.userId !== args.where.userId) {
            return false;
          }

          return true;
        })
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

      return filteredOrders;
    }),
  },
  $transaction: jest.fn(async (operations: Promise<unknown>[]) => {
    return Promise.all(operations);
  }),
  $queryRaw: jest.fn(async () => [{ '?column?': 1 }]),
});

const createRedisMock = () => {
  const store = new Map<string, string>();

  const client = {
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    mget: jest.fn(async (...keys: string[]) =>
      keys.map((key) => store.get(key) ?? null),
    ),
    set: jest.fn(
      async (
        key: string,
        value: string,
        _mode?: 'EX',
        _ttlSeconds?: number,
      ) => {
        store.set(key, value);
        return 'OK';
      },
    ),
    del: jest.fn(async (...keys: string[]) => {
      keys.forEach((key) => {
        store.delete(key);
      });
      return keys.length;
    }),
    ping: jest.fn(async () => 'PONG'),
    multi: jest.fn(() => {
      const operations: Array<() => void> = [];
      const pipeline = {
        set: (
          key: string,
          value: string,
          _mode?: 'EX',
          _ttlSeconds?: number,
        ) => {
          operations.push(() => {
            store.set(key, value);
          });
          return pipeline;
        },
        exec: async () => {
          operations.forEach((operation) => operation());
          return [];
        },
      };

      return pipeline;
    }),
  };

  return {
    setNx: jest.fn(async (key: string, value: string) => {
      if (store.has(key)) {
        return false;
      }

      store.set(key, value);
      return true;
    }),
    del: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    delByPattern: jest.fn(async (pattern: string) => {
      const regex = new RegExp(
        `^${pattern
          .split('*')
          .map((segment) =>
            segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          )
          .join('.*')}$`,
      );

      let deletedCount = 0;

      Array.from(store.keys()).forEach((key) => {
        if (!regex.test(key)) {
          return;
        }

        store.delete(key);
        deletedCount += 1;
      });

      return deletedCount;
    }),
    get: jest.fn(async <T>(key: string) => {
      const value = store.get(key);

      if (value === undefined) {
        return null as T | null;
      }

      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    }),
    set: jest.fn(async (key: string, value: unknown, _ttlSeconds?: number) => {
      const serialized =
        typeof value === 'string' ? value : JSON.stringify(value);
      store.set(key, serialized);
    }),
    ttl: jest.fn(async () => 30),
    publish: jest.fn(async () => 1),
    subscribeOnce: jest.fn(async () => null),
    getClient: jest.fn(() => client),
    store,
  };
};

type WsEnvelope = {
  event: string;
  data: Record<string, unknown>;
};

const waitForWebSocketOpen = (socket: WebSocket): Promise<void> =>
  new Promise((resolve, reject) => {
    const onOpen = () => {
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.off('open', onOpen);
      socket.off('error', onError);
    };

    socket.on('open', onOpen);
    socket.on('error', onError);
  });

const waitForCondition = async (
  predicate: () => boolean,
  timeoutMs = 1000,
  intervalMs = 10,
): Promise<void> => {
  const startedAt = Date.now();

  while (!predicate()) {
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error(`Condition not met within ${timeoutMs}ms`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
};

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const waitForWebSocketClose = (
  socket: WebSocket,
): Promise<{ code: number; reason: string }> =>
  new Promise((resolve) => {
    socket.once('close', (code, reason) => {
      resolve({ code, reason: reason.toString() });
    });
  });

describe('Users CRUD (e2e)', () => {
  let app: NestFastifyApplication;
  let users: MockUser[];
  let orders: MockOrder[];
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let redisMock: ReturnType<typeof createRedisMock>;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  beforeEach(async () => {
    users = createUsers();
    orders = createOrders();
    prismaMock = createPrismaMock(users, orders);
    redisMock = createRedisMock();

    const jwtGuardMock = {
      canActivate: (context: Parameters<typeof JwtAuthGuard.prototype.canActivate>[0]) => {
        const request = context
          .switchToHttp()
          .getRequest<{ headers: Record<string, string | undefined>; user?: CurrentUserPayload }>();
        const authorization = request.headers.authorization;

        if (!authorization?.startsWith('Bearer ')) {
          throw new UnauthorizedException();
        }

        const token = authorization.replace('Bearer ', '');
        const payload = authPayloads[token];

        if (!payload) {
          throw new UnauthorizedException();
        }

        request.user = payload;
        return true;
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [UsersModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(RedisService)
      .useValue(redisMock)
      .overrideGuard(JwtAuthGuard)
      .useValue(jwtGuardMock)
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.useWebSocketAdapter(new WsAdapter(app));
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns the authenticated user for GET /api/users/me without leaking passwordHash', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', 'Bearer user-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Authenticated user retrieved successfully');
    expect(response.body.data).toMatchObject({
      id: userId,
      email: 'user@example.com',
      displayName: 'Standard User',
      role: UserRole.USER,
      isActive: true,
    });
    expect(response.body.data.passwordHash).toBeUndefined();
  });

  it('returns 404 for GET /api/users/me when the authenticated user is soft deleted', async () => {
    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', 'Bearer deleted-token')
      .expect(404);
  });

  it('enforces admin-only access on list, detail, update, and delete endpoints', async () => {
    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', 'Bearer user-token')
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/users/${adminId}`)
      .set('Authorization', 'Bearer user-token')
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/users/${adminId}`)
      .set('Authorization', 'Bearer user-token')
      .send({ displayName: 'Nope' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/users/${adminId}`)
      .set('Authorization', 'Bearer user-token')
      .expect(403);
  });

  it('returns a paginated admin-only list excluding deleted users and password hashes', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/users?page=1&limit=10&search=user')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Users retrieved successfully');
    expect(response.body.meta).toEqual({
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1,
    });
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0].id).toBe(userId);
    expect(response.body.data[1].id).toBe(adminId);
    expect(response.body.data[0].passwordHash).toBeUndefined();
    expect(
      response.body.data.find((item: { id: string }) => item.id === deletedUserId),
    ).toBeUndefined();
  });

  it('returns a single non-deleted user for admin detail lookups', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/users/${userId}`)
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('User retrieved successfully');
    expect(response.body.data).toMatchObject({
      id: userId,
      email: 'user@example.com',
      displayName: 'Standard User',
      role: UserRole.USER,
      isActive: true,
    });
    expect(response.body.data.passwordHash).toBeUndefined();

    await request(app.getHttpServer())
      .get(`/api/users/${deletedUserId}`)
      .set('Authorization', 'Bearer admin-token')
      .expect(404);
  });

  it('updates allowed fields and invalidates the related cache keys', async () => {
    redisMock.store.set(
      'dashboard:summary:user:11111111-1111-1111-1111-111111111111:1h:volume:1h:pnl:week',
      JSON.stringify({ ok: true }),
    );
    redisMock.store.set(
      'dashboard:summary:user:11111111-1111-1111-1111-111111111111:1h:volume:1h:pnl:week:stale',
      JSON.stringify({ ok: true }),
    );
    redisMock.store.set(
      'dashboard:summary:user:22222222-2222-2222-2222-222222222222:4h:volume:15m:pnl:month',
      JSON.stringify({ ok: true }),
    );

    const response = await request(app.getHttpServer())
      .patch(`/api/users/${userId}`)
      .set('Authorization', 'Bearer admin-token')
      .send({
        displayName: 'Updated User',
        role: UserRole.ADMIN,
        isActive: false,
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('User updated successfully');
    expect(response.body.data).toMatchObject({
      id: userId,
      displayName: 'Updated User',
      role: UserRole.ADMIN,
      isActive: false,
    });
    expect(response.body.data.passwordHash).toBeUndefined();
    expect(redisMock.del).toHaveBeenCalledWith('app:users:active-count');
    expect(redisMock.delByPattern).toHaveBeenCalledWith(
      'dashboard:summary:user:*',
    );
    expect(
      Array.from(redisMock.store.keys()).filter((key) =>
        key.startsWith('dashboard:summary:user:'),
      ),
    ).toHaveLength(0);
  });

  it('soft deletes a user, marks it inactive, and excludes it from subsequent reads', async () => {
    redisMock.store.set(
      'dashboard:summary:user:11111111-1111-1111-1111-111111111111:1d:volume:4h:pnl:year',
      JSON.stringify({ ok: true }),
    );

    const response = await request(app.getHttpServer())
      .delete(`/api/users/${userId}`)
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      message: 'User deleted successfully',
      data: null,
    });
    expect(users.find((user) => user.id === userId)?.isActive).toBe(false);
    expect(users.find((user) => user.id === userId)?.deletedAt).not.toBeNull();
    expect(redisMock.del).toHaveBeenCalledWith('app:users:active-count');
    expect(redisMock.delByPattern).toHaveBeenCalledWith(
      'dashboard:summary:user:*',
    );
    expect(
      Array.from(redisMock.store.keys()).filter((key) =>
        key.startsWith('dashboard:summary:user:'),
      ),
    ).toHaveLength(0);

    await request(app.getHttpServer())
      .get(`/api/users/${userId}`)
      .set('Authorization', 'Bearer admin-token')
      .expect(404);
  });

  it('still returns success for update and delete when cache invalidation fails after the DB mutation', async () => {
    redisMock.delByPattern.mockRejectedValue(new Error('Redis unavailable'));

    await request(app.getHttpServer())
      .patch(`/api/users/${userId}`)
      .set('Authorization', 'Bearer admin-token')
      .send({ displayName: 'Still Updated' })
      .expect(200);

    expect(users.find((user) => user.id === userId)?.displayName).toBe(
      'Still Updated',
    );

    await request(app.getHttpServer())
      .delete(`/api/users/${userId}`)
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(users.find((user) => user.id === userId)?.deletedAt).not.toBeNull();
  });
});

describe('Dashboard Summary (e2e)', () => {
  let app: NestFastifyApplication;
  let users: MockUser[];
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let redisMock: ReturnType<typeof createRedisMock>;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  beforeEach(async () => {
    users = createUsers();
    prismaMock = createPrismaMock(users);
    redisMock = createRedisMock();

    const jwtGuardMock = {
      canActivate: (context: Parameters<typeof JwtAuthGuard.prototype.canActivate>[0]) => {
        const request = context
          .switchToHttp()
          .getRequest<{ headers: Record<string, string | undefined>; user?: CurrentUserPayload }>();
        const authorization = request.headers.authorization;

        if (!authorization?.startsWith('Bearer ')) {
          throw new UnauthorizedException();
        }

        const token = authorization.replace('Bearer ', '');
        const payload = authPayloads[token];

        if (!payload) {
          throw new UnauthorizedException();
        }

        request.user = payload;
        return true;
      },
    };

      const marketDataServiceMock = {
        getTrackedTickers: jest.fn(async () => [
          {
            symbol: 'BTCUSDT',
            price: '65000',
          volume24h: '1000000',
          priceChange24h: '2.5',
          high24h: '66000',
          low24h: '64000',
            fetchedAt: new Date().toISOString(),
          },
        ]),
        getDashboardBtcPriceTrend: jest.fn(async (range = '1h') => ({
          range,
          currency: 'USD',
          livePrice: 68140,
          change24h: 900,
          change24hPercent: 1.34,
          labels: ['19:00', '20:00', '21:00'],
          series: [67240, 67680, 68140],
          high: 68140,
          low: 67240,
          updatedAt: new Date().toISOString(),
        })),
        getDashboardVolumeProfile: jest.fn(async (timeframe = '1h') => ({
          timeframe,
          labels: ['19:00', '20:00', '21:00'],
          volume: [100, 120, 130],
          colors: ['#22c55e', '#ef4444', '#22c55e'],
          updatedAt: new Date().toISOString(),
        })),
        buildDashboardMarketComposition: jest.fn((tickers: Array<{ symbol: string }>) => ({
          marketOverview: {
            btcDominance: tickers.some((ticker) => ticker.symbol === 'BTCUSDT') ? 100 : 0,
            fearGreedIndex: 55,
          },
          marketShare: [
            { symbol: 'BTC', dominance: tickers.some((ticker) => ticker.symbol === 'BTCUSDT') ? 100 : 0 },
            { symbol: 'ETH', dominance: 0 },
            { symbol: 'OTHERS', dominance: 0 },
          ],
        })),
      };

    const binanceServiceMock = {
      getTicker: jest.fn(async () => ({
        symbol: 'BTCUSDT',
        price: '68140',
        volume24h: '1000000',
        priceChange24h: '900',
        priceChange24hPercent: '1.34',
        high24h: '68140',
        low24h: '67240',
        fetchedAt: new Date().toISOString(),
        source: 'binance',
      })),
      getKlines: jest.fn(async () => [
        [
          1711929600000,
          '67000.00',
          '67300.00',
          '66800.00',
          '67240.00',
          '100.00',
          1711933199999,
          '0',
          10,
          '0',
          '0',
          '0',
        ],
        [
          1711933200000,
          '67240.00',
          '67700.00',
          '67100.00',
          '67680.00',
          '120.00',
          1711936799999,
          '0',
          10,
          '0',
          '0',
          '0',
        ],
        [
          1711936800000,
          '67680.00',
          '68200.00',
          '67500.00',
          '68140.00',
          '130.00',
          1711940399999,
          '0',
          10,
          '0',
          '0',
          '0',
        ],
      ]),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(RedisService)
      .useValue(redisMock)
      .overrideProvider(MarketDataService)
      .useValue(marketDataServiceMock)
      .overrideProvider(BinanceService)
      .useValue(binanceServiceMock)
      .overrideGuard(JwtAuthGuard)
      .useValue(jwtGuardMock)
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.useWebSocketAdapter(new WsAdapter(app));
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    if (app) {
      await app.close();
    }
  });

  it('returns 200 with stable response shape for GET /api/dashboard/summary', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/dashboard/summary')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    // success wrapper
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Dashboard summary retrieved successfully');

    const { data } = response.body;

    // required top-level fields
    expect(data).toHaveProperty('userCount');
    expect(Array.isArray(data.topMovers)).toBe(true);
    expect(data).toHaveProperty('marketOverview');
    expect(Array.isArray(data.marketShare)).toBe(true);
    expect(data).toHaveProperty('btcPriceTrend');
    expect(data).toHaveProperty('volumeProfile');
    expect(data).toHaveProperty('dailyPnl');
    expect(data).toHaveProperty('openOrders');
    expect(data).toHaveProperty('health');
    expect(data).toHaveProperty('warnings');
    expect(typeof data.generatedAt).toBe('string');

    // marketOverview shape
    expect(typeof data.marketOverview.btcDominance).toBe('number');
    expect(typeof data.marketOverview.fearGreedIndex).toBe('number');

    if (data.marketShare.length > 0) {
      const totalDominance = data.marketShare.reduce(
        (sum: number, item: { dominance: number }) => sum + item.dominance,
        0,
      );

      data.marketShare.forEach(
        (item: { symbol: string; dominance: number }) => {
          expect(typeof item.symbol).toBe('string');
          expect(typeof item.dominance).toBe('number');
        },
      );

      expect(totalDominance).toBeGreaterThan(0);
      expect(totalDominance).toBeLessThanOrEqual(100);
    }

    expect(data.btcPriceTrend).toHaveProperty('range', '1h');
    expect(data.btcPriceTrend).toHaveProperty('currency', 'USD');
    expect(Array.isArray(data.btcPriceTrend.labels)).toBe(true);
    expect(Array.isArray(data.btcPriceTrend.series)).toBe(true);
    expect(typeof data.btcPriceTrend.livePrice).toBe('number');
    expect(typeof data.btcPriceTrend.change24h).toBe('number');
    expect(typeof data.btcPriceTrend.change24hPercent).toBe('number');
    expect(typeof data.btcPriceTrend.high).toBe('number');
    expect(typeof data.btcPriceTrend.low).toBe('number');
    expect(typeof data.btcPriceTrend.updatedAt).toBe('string');
    expect(data.volumeProfile).toHaveProperty('timeframe', '1h');
    expect(Array.isArray(data.volumeProfile.labels)).toBe(true);
    expect(Array.isArray(data.volumeProfile.volume)).toBe(true);
    expect(Array.isArray(data.volumeProfile.colors)).toBe(true);
    expect(typeof data.volumeProfile.updatedAt).toBe('string');
    expect(data.volumeProfile.labels.length).toBe(data.volumeProfile.volume.length);
    expect(data.volumeProfile.labels.length).toBe(data.volumeProfile.colors.length);
    expect(typeof data.dailyPnl.weeklyNet).toBe('number');
    expect(Array.isArray(data.dailyPnl.series)).toBe(true);
    expect(data.dailyPnl.series).toHaveLength(7);
    expect(data.dailyPnl.stats).toMatchObject({
      best: expect.any(Number),
      worst: expect.any(Number),
      avg: expect.any(Number),
      win: expect.any(Number),
      loss: expect.any(Number),
    });
    expect(typeof data.dailyPnl.updatedAt).toBe('string');
    expect(data.openOrders).toMatchObject({
      activeCount: expect.any(Number),
      totalCount: expect.any(Number),
      updatedAt: expect.any(String),
    });
    expect(Array.isArray(data.openOrders.items)).toBe(true);

    if (data.openOrders.items.length > 0) {
      expect(data.openOrders.items[0]).toMatchObject({
        id: expect.any(String),
        pair: expect.any(String),
        side: expect.stringMatching(/BUY|SELL/),
        type: expect.any(String),
        price: expect.any(Number),
        amount: expect.any(Number),
        filledPercent: expect.any(Number),
        totalUsd: expect.any(Number),
        status: expect.any(String),
        createdAtLabel: expect.any(String),
      });
    }

    data.dailyPnl.series.forEach((point: { day: string; value: number }) => {
      expect(typeof point.day).toBe('string');
      expect(typeof point.value).toBe('number');
    });

    // health shape
    expect(data.health).toHaveProperty('db');
    expect(data.health).toHaveProperty('redis');
    expect(data.health).toHaveProperty('wsConnections');

    // topMovers item shape (when present)
    if (data.topMovers.length > 0) {
      const mover = data.topMovers[0];
      expect(mover).toHaveProperty('symbol');
      expect(mover).toHaveProperty('price');
      expect(mover).toHaveProperty('volume24h');
      expect(mover).toHaveProperty('priceChange24h');
      expect(mover).toHaveProperty('high24h');
      expect(mover).toHaveProperty('low24h');
      expect(mover).toHaveProperty('fetchedAt');
    }
  });

  it('accepts range queries and returns timeframe-specific trend + volume data', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/dashboard/summary?range=4h&volumeTf=15m')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.btcPriceTrend.range).toBe('4h');
    expect(response.body.data.volumeProfile.timeframe).toBe('15m');
  });

  it('returns 401 for unauthenticated GET /api/dashboard/summary', async () => {
    await request(app.getHttpServer()).get('/api/dashboard/summary').expect(401);
  });
});

describe('Market Data Ticker Flow (e2e)', () => {
  let app: NestFastifyApplication;
  let users: MockUser[];
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let redisMock: ReturnType<typeof createRedisMock>;
  let binanceServiceMock: {
    getTicker: jest.Mock;
  };

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.BINANCE_BASE_URL = 'https://example.test';
  });

  beforeEach(async () => {
    users = createUsers();
    prismaMock = createPrismaMock(users);
    redisMock = createRedisMock();

    const jwtGuardMock = {
      canActivate: (context: Parameters<typeof JwtAuthGuard.prototype.canActivate>[0]) => {
        const request = context
          .switchToHttp()
          .getRequest<{ headers: Record<string, string | undefined>; user?: CurrentUserPayload }>();
        const authorization = request.headers.authorization;

        if (!authorization?.startsWith('Bearer ')) {
          throw new UnauthorizedException();
        }

        const token = authorization.replace('Bearer ', '');
        const payload = authPayloads[token];

        if (!payload) {
          throw new UnauthorizedException();
        }

        request.user = payload;
        return true;
      },
    };

    binanceServiceMock = {
      getTicker: jest.fn(async (symbol: string) => ({
        symbol,
        price: '65000',
        volume24h: '1000000',
        priceChange24h: '2.5',
        high24h: '66000',
        low24h: '64000',
        fetchedAt: new Date().toISOString(),
        source: 'binance',
      })),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(RedisService)
      .useValue(redisMock)
      .overrideProvider(BinanceService)
      .useValue(binanceServiceMock)
      .overrideGuard(JwtAuthGuard)
      .useValue(jwtGuardMock)
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.useWebSocketAdapter(new WsAdapter(app));
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    if (app) {
      await app.close();
    }
  });

  const loginAsAdmin = async () => 'admin-token';

  it('returns 200 for authenticated users and includes the ticker response shape', async () => {
    const accessToken = await loginAsAdmin();

    const response = await request(app.getHttpServer())
      .get('/api/market/ticker/BTCUSDT')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Ticker retrieved successfully');
    expect(response.body.data).toHaveProperty('symbol', 'BTCUSDT');
    expect(response.body.data).toHaveProperty('price');
    expect(response.body.data).toHaveProperty('volume24h');
    expect(response.body.data).toHaveProperty('priceChange24h');
    expect(response.body.data).toHaveProperty('high24h');
    expect(response.body.data).toHaveProperty('low24h');
    expect(response.body.data).toHaveProperty('fetchedAt');
    expect(response.body.data).toHaveProperty('source');
    expect(response.body.data).toHaveProperty('cacheSource');
    expect(['fresh', 'hot', 'stale']).toContain(response.body.data.cacheSource);
  });

  it('returns stable cached data on repeated requests for the same symbol', async () => {
    const accessToken = await loginAsAdmin();

    const firstResponse = await request(app.getHttpServer())
      .get('/api/market/ticker/BTCUSDT')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const secondResponse = await request(app.getHttpServer())
      .get('/api/market/ticker/BTCUSDT')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(secondResponse.body.data).toHaveProperty('symbol', 'BTCUSDT');
    expect(secondResponse.body.data).toHaveProperty('price');
    expect(secondResponse.body.data).toHaveProperty('fetchedAt');
    expect(secondResponse.body.data).toHaveProperty('cacheSource');

    if (secondResponse.body.data.cacheSource === 'hot') {
      expect(secondResponse.body.data.fetchedAt).toBe(
        firstResponse.body.data.fetchedAt,
      );
    } else {
      expect(['fresh', 'hot', 'stale']).toContain(
        secondResponse.body.data.cacheSource,
      );
    }
  });

  it('returns 503 when upstream is unavailable and no stale cache exists', async () => {
    const accessToken = await loginAsAdmin();

    binanceServiceMock.getTicker.mockRejectedValueOnce(
      new BinanceUnavailableException(
        'Binance ticker fetch failed for ETHUSDT',
      ),
    );

    const response = await request(app.getHttpServer())
      .get('/api/market/ticker/ETHUSDT')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(503);

    expect(response.body.statusCode).toBe(503);
    expect(String(response.body.message)).toContain('temporarily unavailable');
  });

  it('returns stale data when upstream is unavailable and stale cache exists', async () => {
    const accessToken = await loginAsAdmin();

    const warmResponse = await request(app.getHttpServer())
      .get('/api/market/ticker/BTCUSDT')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(['fresh', 'hot']).toContain(warmResponse.body.data.cacheSource);

    redisMock.store.delete('app:ticker:BTCUSDT:hot');
    binanceServiceMock.getTicker.mockRejectedValueOnce(
      new BinanceUnavailableException(
        'Binance ticker fetch failed for BTCUSDT',
      ),
    );

    const staleResponse = await request(app.getHttpServer())
      .get('/api/market/ticker/BTCUSDT')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(staleResponse.body.data.cacheSource).toBe('stale');
    expect(staleResponse.body.data.stale).toBe(true);
    expect(staleResponse.body.data.symbol).toBe('BTCUSDT');
    expect(staleResponse.body.data).toHaveProperty('price');
    expect(staleResponse.body.data).toHaveProperty('fetchedAt');
  });
});

// ---------------------------------------------------------------------------
// Auth endpoints (e2e)
// ---------------------------------------------------------------------------
// These tests exercise the real JWT flow: registration, login, and /auth/me.
// The AuthModule is bootstrapped in isolation with a minimal Prisma mock so
// no database or Redis instance is required.
// ---------------------------------------------------------------------------

describe('Auth endpoints (e2e)', () => {
  let app: NestFastifyApplication;
  let authPrismaMock: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
  };

  // Use a low bcrypt cost in tests so the suite stays fast.
  const TEST_BCRYPT_ROUNDS = 4;
  const testPassword = 'Password123!';
  let testPasswordHash: string;

  const existingUserId = adminId;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.BINANCE_BASE_URL = 'https://example.test';
    testPasswordHash = await bcrypt.hash(testPassword, TEST_BCRYPT_ROUNDS);
  });

  beforeEach(async () => {
    // In-memory users store — mutated by the create mock so register tests
    // can immediately verify the returned data without hitting a real DB.
    const inMemoryUsers: MockUser[] = [
      {
        id: existingUserId,
        email: 'existing@example.com',
        passwordHash: testPasswordHash,
        displayName: 'Existing User',
        role: UserRole.USER,
        isActive: true,
        createdAt: new Date('2026-03-30T10:00:00.000Z'),
        updatedAt: new Date('2026-03-30T10:00:00.000Z'),
        deletedAt: null,
      },
    ];

    authPrismaMock = {
      user: {
        findUnique: jest.fn(async (args: Record<string, any>) => {
          const where = args?.where as Record<string, string> | undefined;
          if (where?.email) {
            return inMemoryUsers.find((u) => u.email === where.email) ?? null;
          }
          if (where?.id) {
            return inMemoryUsers.find((u) => u.id === where.id) ?? null;
          }
          return null;
        }),
        create: jest.fn(async (args: Record<string, any>) => {
          const data = args.data as MockUser & { passwordHash: string };
          const created: MockUser = {
            id: '99999999-9999-9999-9999-999999999999',
            email: data.email,
            passwordHash: data.passwordHash,
            displayName: data.displayName,
            role: data.role ?? UserRole.USER,
            isActive: data.isActive ?? true,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          };
          inMemoryUsers.push(created);
          return created;
        }),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuthModule],
    })
      .overrideProvider(PrismaService)
      .useValue(authPrismaMock)
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /api/auth/register creates a user and returns safe fields (no passwordHash)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'newuser@example.com',
        password: testPassword,
        displayName: 'New User',
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('User registered successfully');
    expect(response.body.data).toMatchObject({
      email: 'newuser@example.com',
      displayName: 'New User',
      role: UserRole.USER,
      isActive: true,
    });
    expect(response.body.data.id).toBeDefined();
    expect(response.body.data.passwordHash).toBeUndefined();
  });

  it('POST /api/auth/register returns 409 when the email already exists', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'existing@example.com',
        password: testPassword,
        displayName: 'Duplicate',
      })
      .expect(409);

    expect(response.body.success).toBe(false);
    expect(response.body.statusCode).toBe(409);
    expect(String(response.body.message).toLowerCase()).toContain('email');
  });

  it('POST /api/auth/register returns 409 when the database unique constraint loses a race', async () => {
    authPrismaMock.user.create.mockRejectedValueOnce({ code: 'P2002' });

    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'racy@example.com',
        password: testPassword,
        displayName: 'Race Winner',
      })
      .expect(409);

    expect(response.body.success).toBe(false);
    expect(response.body.statusCode).toBe(409);
    expect(String(response.body.message).toLowerCase()).toContain('email');
  });

  it('POST /api/auth/register returns 400 for invalid input', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: '123' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.statusCode).toBe(400);
    expect(Array.isArray(response.body.message)).toBe(true);
  });

  it('POST /api/auth/login returns an accessToken for valid credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'existing@example.com', password: testPassword })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Login successful');
    expect(response.body.data.accessToken).toBeDefined();
    expect(typeof response.body.data.accessToken).toBe('string');
    expect(response.body.data.tokenType).toBe('Bearer');
    expect(response.body.data.expiresIn).toBe('15m');
  });

  it('POST /api/auth/login returns 401 for wrong password', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'existing@example.com', password: 'WrongPass999!' })
      .expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.statusCode).toBe(401);
  });

  it('POST /api/auth/login returns 401 for unknown email', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: testPassword })
      .expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.statusCode).toBe(401);
  });

  it('GET /api/auth/me returns 401 when no Authorization header is sent', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.statusCode).toBe(401);
  });

  it('GET /api/auth/me returns the authenticated user for a valid JWT', async () => {
    // Obtain a real signed token via login so the JWT strategy validates it.
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'existing@example.com', password: testPassword })
      .expect(200);

    const token = loginRes.body.data.accessToken as string;

    const meRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(meRes.body.success).toBe(true);
    expect(meRes.body.data).toMatchObject({
      id: existingUserId,
      email: 'existing@example.com',
      displayName: 'Existing User',
      role: UserRole.USER,
      isActive: true,
    });
    expect(meRes.body.data.passwordHash).toBeUndefined();
  });
});

describe('WebSocket realtime events (integration)', () => {
  let app: NestFastifyApplication;
  let users: MockUser[];
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let redisMock: ReturnType<typeof createRedisMock>;
  let authenticatedWsClients: WebSocket[];
  let anonymousWsClient: WebSocket;
  let wsMessages: WsEnvelope[][];
  let wsBaseUrl: string;
  let jwtService: JwtService;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.BINANCE_BASE_URL = 'https://example.test';
  });

  beforeEach(async () => {
    users = createUsers();
    prismaMock = createPrismaMock(users);
    redisMock = createRedisMock();

    const jwtGuardMock = {
      canActivate: (
        context: Parameters<typeof JwtAuthGuard.prototype.canActivate>[0],
      ) => {
        const request = context.switchToHttp().getRequest<{
          headers: Record<string, string | undefined>;
          user?: CurrentUserPayload;
        }>();
        const authorization = request.headers.authorization;

        if (!authorization?.startsWith('Bearer ')) {
          throw new UnauthorizedException();
        }

        const token = authorization.replace('Bearer ', '');
        const payload = authPayloads[token];

        if (!payload) {
          throw new UnauthorizedException();
        }

        request.user = payload;
        return true;
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(RedisService)
      .useValue(redisMock)
      .overrideGuard(JwtAuthGuard)
      .useValue(jwtGuardMock)
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.useWebSocketAdapter(new WsAdapter(app));
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.listen({ port: 0, host: '127.0.0.1' });

    const appUrl = await app.getUrl();
    wsBaseUrl = appUrl.replace(/^http/, 'ws');
    jwtService = new JwtService({ secret: 'test-secret' });
    const authenticatedTokens = await Promise.all([
      jwtService.signAsync(authPayloads['admin-token']),
      jwtService.signAsync(authPayloads['user-token']),
    ]);

    wsMessages = [[], [], []];
    authenticatedWsClients = authenticatedTokens.map((token, index) => {
      const client = new WebSocket(`${wsBaseUrl}/ws?token=${encodeURIComponent(token)}`);

      client.on('message', (payload: RawData) => {
        wsMessages[index].push(JSON.parse(payload.toString()) as WsEnvelope);
      });

      return client;
    });

    anonymousWsClient = new WebSocket(`${wsBaseUrl}/ws`);
    anonymousWsClient.on('message', (payload: RawData) => {
      wsMessages[2].push(JSON.parse(payload.toString()) as WsEnvelope);
    });

    await Promise.all([
      ...authenticatedWsClients.map((client) => waitForWebSocketOpen(client)),
      waitForWebSocketOpen(anonymousWsClient),
    ]);
  });

  afterEach(async () => {
    const clients = [
      ...(authenticatedWsClients ?? []),
      ...(anonymousWsClient ? [anonymousWsClient] : []),
    ];

    if (clients.length) {
      await Promise.all(
        clients.map(
          (client) =>
            new Promise<void>((resolve) => {
              if (
                client.readyState === WebSocket.CLOSED ||
                client.readyState === WebSocket.CLOSING
              ) {
                resolve();
                return;
              }

              client.once('close', () => resolve());
              client.close();
            }),
        ),
      );
    }

    if (app) {
      await app.close();
    }
  });

    it('broadcasts exactly one safe user.created event to admin websocket clients only after successful registration', async () => {
      expect(wsMessages[0]).toHaveLength(0);
      expect(wsMessages[1]).toHaveLength(0);
      expect(wsMessages[2]).toHaveLength(0);

    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'streamed@example.com',
        password: 'Password123!',
        displayName: 'Streamed User',
      })
      .expect(201);

      await waitForCondition(
        () =>
          wsMessages[0].filter((message) => message.event === 'user.created')
            .length === 1,
        1000,
      );

      await delay(150);

      const createdEvents = wsMessages[0].filter(
        (message) => message.event === 'user.created',
      );

      expect(createdEvents).toHaveLength(1);
      expect(createdEvents[0].data).toMatchObject({
        id: response.body.data.id,
        email: 'streamed@example.com',
        displayName: 'Streamed User',
      });
      expect(createdEvents[0].data.passwordHash).toBeUndefined();

      expect(
        wsMessages[1].some((message) => message.event === 'user.created'),
      ).toBe(false);

      expect(
        wsMessages[2].some((message) => message.event === 'user.created'),
      ).toBe(false);
    });

    it('broadcasts exactly one safe user.updated event to admin clients and the affected user only for successful updates', async () => {
      const failedResponse = await request(app.getHttpServer())
        .patch('/api/users/99999999-9999-9999-9999-999999999999')
        .set('Authorization', 'Bearer admin-token')
      .send({ displayName: 'No Event' })
      .expect(404);

    expect(failedResponse.body.success).toBe(false);
    await delay(150);
    expect(
      wsMessages.slice(0, 2).some((messages) =>
        messages.some((message) => message.event === 'user.updated'),
      ),
    ).toBe(false);

      const response = await request(app.getHttpServer())
        .patch(`/api/users/${userId}`)
        .set('Authorization', 'Bearer admin-token')
        .send({ displayName: 'Realtime User' })
        .expect(200);

      await waitForCondition(
        () =>
          wsMessages[0].filter((message) => message.event === 'user.updated')
            .length === 1 &&
          wsMessages[1].filter((message) => message.event === 'user.updated')
            .length === 1,
        1000,
      );

      await delay(150);

      wsMessages.slice(0, 2).forEach((messages) => {
        const updatedEvents = messages.filter(
          (message) => message.event === 'user.updated',
        );

      expect(updatedEvents).toHaveLength(1);
      expect(updatedEvents[0].data).toMatchObject({
        id: response.body.data.id,
        email: response.body.data.email,
        displayName: 'Realtime User',
      });
      expect(updatedEvents[0].data.passwordHash).toBeUndefined();
    });

      expect(
        wsMessages[2].some((message) => message.event === 'user.updated'),
      ).toBe(false);
    });

  it('gracefully closes websocket connections when a provided token is invalid', async () => {
    const invalidClient = new WebSocket(`${wsBaseUrl}/ws?token=not-a-real-token`);
    const closeResult = await waitForWebSocketClose(invalidClient);

    expect(closeResult.code).toBe(4401);
    expect(closeResult.reason).toContain('Invalid websocket credentials');
  });
});
