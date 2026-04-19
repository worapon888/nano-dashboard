import { ValidationPipe, UnauthorizedException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { UserRole } from '@prisma/client';
import type { Socket as SocketClient } from 'socket.io-client';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import type { CurrentUserPayload } from '../../src/auth/interfaces/current-user-payload.interface';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';

export type MockUser = {
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

export type MockOrder = {
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

export const adminId = '11111111-1111-1111-1111-111111111111';
export const userId = '22222222-2222-2222-2222-222222222222';
export const deletedUserId = '33333333-3333-3333-3333-333333333333';

export const authPayloads: Record<string, CurrentUserPayload> = {
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

export function createUsers(): MockUser[] {
  return [
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
}

export function createOrders(): MockOrder[] {
  return [
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
}

function applyUserSelect(
  user: MockUser,
  select?: Record<string, boolean>,
): Record<string, unknown> {
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
}

function matchesWhere(user: MockUser, where?: Record<string, any>): boolean {
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
}

export function createPrismaMock(users: MockUser[], orders: MockOrder[] = []) {
  return {
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
  };
}

export function createRedisMock() {
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
    isReady: jest.fn(() => true),
    store,
  };
}

export type WsEnvelope = {
  event: string;
  data: Record<string, unknown>;
};

export function createJwtGuardMock() {
  return {
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
}

export function applyCommonAppSetup(app: INestApplication, enableWebSocket = true) {
  if (enableWebSocket) {
    app.useWebSocketAdapter(new IoAdapter(app));
  }

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
}

export const waitForSocketConnect = (socket: SocketClient): Promise<void> =>
  new Promise((resolve, reject) => {
    const onConnect = () => {
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.off('connect', onConnect);
      socket.off('connect_error', onError);
    };

    socket.on('connect', onConnect);
    socket.on('connect_error', onError);
  });

export const waitForCondition = async (
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

export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const waitForSocketDisconnect = (socket: SocketClient): Promise<void> =>
  new Promise((resolve) => {
    socket.once('disconnect', () => resolve());
  });
