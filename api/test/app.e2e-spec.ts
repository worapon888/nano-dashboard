import { ValidationPipe, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import type { CurrentUserPayload } from '../src/auth/interfaces/current-user-payload.interface';
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

const createPrismaMock = (users: MockUser[]) => ({
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
  $transaction: jest.fn(async (operations: Promise<unknown>[]) => {
    return Promise.all(operations);
  }),
});

describe('Users CRUD (e2e)', () => {
  let app: NestFastifyApplication;
  let users: MockUser[];
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let redisMock: {
    del: jest.Mock<Promise<void>, [string]>;
    get: jest.Mock<Promise<number | null>, [string]>;
    set: jest.Mock<Promise<void>, [string, unknown, number?]>;
  };

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  beforeEach(async () => {
    users = createUsers();
    prismaMock = createPrismaMock(users);
    redisMock = {
      del: jest.fn(async () => undefined),
      get: jest.fn(async () => null),
      set: jest.fn(async () => undefined),
    };

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

    expect(response.body).toMatchObject({
      id: userId,
      email: 'user@example.com',
      displayName: 'Standard User',
      role: UserRole.USER,
      isActive: true,
    });
    expect(response.body.passwordHash).toBeUndefined();
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

    expect(response.body.meta).toEqual({
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1,
    });
    expect(response.body.items).toHaveLength(2);
    expect(response.body.items[0].id).toBe(userId);
    expect(response.body.items[1].id).toBe(adminId);
    expect(response.body.items[0].passwordHash).toBeUndefined();
    expect(response.body.items.find((item: { id: string }) => item.id === deletedUserId)).toBeUndefined();
  });

  it('returns a single non-deleted user for admin detail lookups', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/users/${userId}`)
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(response.body).toMatchObject({
      id: userId,
      email: 'user@example.com',
      displayName: 'Standard User',
      role: UserRole.USER,
      isActive: true,
    });
    expect(response.body.passwordHash).toBeUndefined();

    await request(app.getHttpServer())
      .get(`/api/users/${deletedUserId}`)
      .set('Authorization', 'Bearer admin-token')
      .expect(404);
  });

  it('updates allowed fields and invalidates the related cache keys', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/users/${userId}`)
      .set('Authorization', 'Bearer admin-token')
      .send({
        displayName: 'Updated User',
        role: UserRole.ADMIN,
        isActive: false,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: userId,
      displayName: 'Updated User',
      role: UserRole.ADMIN,
      isActive: false,
    });
    expect(response.body.passwordHash).toBeUndefined();
    expect(redisMock.del).toHaveBeenCalledWith('app:user:active_count');
    expect(redisMock.del).toHaveBeenCalledWith('app:dashboard:summary');
    expect(redisMock.del).toHaveBeenCalledWith(`dashboard:summary:${userId}`);
  });

  it('soft deletes a user, marks it inactive, and excludes it from subsequent reads', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/api/users/${userId}`)
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(response.body).toEqual({ success: true });
    expect(users.find((user) => user.id === userId)?.isActive).toBe(false);
    expect(users.find((user) => user.id === userId)?.deletedAt).not.toBeNull();
    expect(redisMock.del).toHaveBeenCalledWith('app:user:active_count');
    expect(redisMock.del).toHaveBeenCalledWith('app:dashboard:summary');
    expect(redisMock.del).toHaveBeenCalledWith(`dashboard:summary:${userId}`);

    await request(app.getHttpServer())
      .get(`/api/users/${userId}`)
      .set('Authorization', 'Bearer admin-token')
      .expect(404);
  });
});
