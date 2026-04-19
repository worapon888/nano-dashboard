import { ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { adminId } from './support/e2e-helpers';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Auth endpoints (e2e)', () => {
  let app: NestFastifyApplication;
  let authPrismaMock: {
    user: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

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
    const inMemoryUsers = [
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
        findFirst: jest.fn(async (args?: Record<string, any>) => {
          const where = args?.where as Record<string, any> | undefined;
          if (!where) {
            return inMemoryUsers[0] ?? null;
          }

          return (
            inMemoryUsers.find((user) => {
              if (where.email && user.email !== where.email) {
                return false;
              }

              if (where.deletedAt === null && user.deletedAt !== null) {
                return false;
              }

              return true;
            }) ?? null
          );
        }),
        create: jest.fn(async (args: Record<string, any>) => {
          const data = args.data as {
            email: string;
            passwordHash: string;
            displayName: string;
            role?: UserRole;
            isActive?: boolean;
          };
          const created = {
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
        update: jest.fn(async (args: Record<string, any>) => {
          const target = inMemoryUsers.find((user) => user.id === args.where.id);

          if (!target) {
            throw new Error('User not found');
          }

          Object.assign(target, args.data, {
            updatedAt: new Date(),
          });

          return target;
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

    expect(response.body.statusCode).toBe(409);
    expect(String(response.body.message).toLowerCase()).toContain('email');
  });

  it('POST /api/auth/register returns 400 for invalid input', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: '123' })
      .expect(400);

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

    expect(response.body.statusCode).toBe(401);
  });

  it('POST /api/auth/login returns 401 for unknown email', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: testPassword })
      .expect(401);

    expect(response.body.statusCode).toBe(401);
  });

  it('GET /api/auth/me returns 401 when no Authorization header is sent', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .expect(401);

    expect(response.body.statusCode).toBe(401);
  });

  it('GET /api/auth/me returns the authenticated user for a valid JWT', async () => {
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
