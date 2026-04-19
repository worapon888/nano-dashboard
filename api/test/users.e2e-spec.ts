import { ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import request from 'supertest';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { UsersModule } from '../src/users/users.module';
import {
  adminId,
  applyCommonAppSetup,
  createJwtGuardMock,
  createOrders,
  createPrismaMock,
  createRedisMock,
  createUsers,
  deletedUserId,
  userId,
} from './support/e2e-helpers';

describe('Users CRUD (e2e)', () => {
  let app: NestFastifyApplication;
  let users = createUsers();
  let orders = createOrders();
  let prismaMock = createPrismaMock(users, orders);
  let redisMock = createRedisMock();

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  beforeEach(async () => {
    users = createUsers();
    orders = createOrders();
    prismaMock = createPrismaMock(users, orders);
    redisMock = createRedisMock();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [UsersModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(RedisService)
      .useValue(redisMock)
      .overrideGuard(JwtAuthGuard)
      .useValue(createJwtGuardMock())
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    applyCommonAppSetup(app);

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

  it('allows authenticated reads but enforces owner-or-admin checks on update and delete endpoints', async () => {
    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', 'Bearer user-token')
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/users/${adminId}`)
      .set('Authorization', 'Bearer user-token')
      .expect(200);

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
