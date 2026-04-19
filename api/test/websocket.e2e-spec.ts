import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import request from 'supertest';
import { io as createSocketClient, Socket as SocketClient } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import {
  adminId,
  applyCommonAppSetup,
  authPayloads,
  createJwtGuardMock,
  createPrismaMock,
  createRedisMock,
  createUsers,
  delay,
  userId,
  waitForCondition,
  waitForSocketConnect,
  waitForSocketDisconnect,
  type WsEnvelope,
} from './support/e2e-helpers';

describe('WebSocket realtime events (integration)', () => {
  let app: NestFastifyApplication;
  let prismaMock = createPrismaMock(createUsers());
  let redisMock = createRedisMock();
  let authenticatedWsClients: SocketClient[] = [];
  let anonymousWsClient: SocketClient;
  let wsMessages: WsEnvelope[][] = [[], [], []];
  let appUrl: string;
  let jwtService: JwtService;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.BINANCE_BASE_URL = 'https://example.test';
  });

  beforeEach(async () => {
    prismaMock = createPrismaMock(createUsers());
    redisMock = createRedisMock();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
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

    await app.listen({ port: 0, host: '127.0.0.1' });
    appUrl = await app.getUrl();
    jwtService = new JwtService({ secret: 'test-secret' });
    const authenticatedTokens = await Promise.all([
      jwtService.signAsync(authPayloads['admin-token']),
      jwtService.signAsync(authPayloads['user-token']),
    ]);

    wsMessages = [[], [], []];
    authenticatedWsClients = authenticatedTokens.map((token, index) => {
      const client = createSocketClient(`${appUrl}/users`, {
        transports: ['websocket'],
        reconnection: false,
      });

      client.on('user.created', (payload: Record<string, unknown>) => {
        wsMessages[index].push({ event: 'user.created', data: payload });
      });
      client.on('user.updated', (payload: Record<string, unknown>) => {
        wsMessages[index].push({ event: 'user.updated', data: payload });
      });

      return client;
    });

    anonymousWsClient = createSocketClient(`${appUrl}/users`, {
      transports: ['websocket'],
      reconnection: false,
    });
    anonymousWsClient.on('user.created', (payload: Record<string, unknown>) => {
      wsMessages[2].push({ event: 'user.created', data: payload });
    });
    anonymousWsClient.on('user.updated', (payload: Record<string, unknown>) => {
      wsMessages[2].push({ event: 'user.updated', data: payload });
    });

    await Promise.all([
      ...authenticatedWsClients.map((client) => waitForSocketConnect(client)),
      waitForSocketConnect(anonymousWsClient),
    ]);
  });

  afterEach(async () => {
    const clients = [
      ...authenticatedWsClients,
      ...(anonymousWsClient ? [anonymousWsClient] : []),
    ];

    if (clients.length) {
      await Promise.all(
        clients.map(async (client) => {
          if (!client.connected) {
            client.close();
            return;
          }

          const disconnectPromise = waitForSocketDisconnect(client);
          client.close();
          await disconnectPromise;
        }),
      );
    }

    if (app) {
      await app.close();
    }
  });

  it('broadcasts exactly one safe user.created event to every connected /users client after successful registration', async () => {
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
      name: 'Streamed User',
    });
    expect(createdEvents[0].data.passwordHash).toBeUndefined();

    expect(
      wsMessages[1].filter((message) => message.event === 'user.created'),
    ).toHaveLength(1);
    expect(
      wsMessages[2].filter((message) => message.event === 'user.created'),
    ).toHaveLength(1);
  });

  it('broadcasts exactly one safe user.updated event to every connected /users client for successful updates', async () => {
    const failedResponse = await request(app.getHttpServer())
      .patch('/api/users/99999999-9999-9999-9999-999999999999')
      .set('Authorization', 'Bearer admin-token')
      .send({ displayName: 'No Event' })
      .expect(404);

    expect(failedResponse.body.statusCode).toBe(404);
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

    await waitForCondition(() => {
      return wsMessages.every(
        (messages) =>
          messages.filter((message) => message.event === 'user.updated')
            .length === 1,
      );
    }, 1000);

    await delay(150);

    wsMessages.forEach((messages) => {
      const updatedEvents = messages.filter(
        (message) => message.event === 'user.updated',
      );

      expect(updatedEvents).toHaveLength(1);
      expect(updatedEvents[0].data).toMatchObject({
        id: response.body.data.id,
        email: response.body.data.email,
        name: 'Realtime User',
      });
      expect(updatedEvents[0].data.passwordHash).toBeUndefined();
    });
  });

  it('emits ws.error and disconnects when a provided token is invalid on /ws', async () => {
    const invalidClient = createSocketClient(appUrl, {
      path: '/ws',
      transports: ['websocket'],
      reconnection: false,
      auth: {
        token: 'not-a-real-token',
      },
    });

    const errorMessage = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timed out waiting for ws.error'));
      }, 1000);

      invalidClient.on('ws.error', (payload: { message?: string }) => {
        clearTimeout(timeout);
        resolve(payload.message ?? '');
      });
      invalidClient.on('connect_error', reject);
    });

    expect(errorMessage).toContain('Invalid websocket credentials');
    invalidClient.close();
  });
});
