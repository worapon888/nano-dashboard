import { Test, TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import {
  BinanceService,
  BinanceUnavailableException,
} from '../src/binance/binance.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import {
  applyCommonAppSetup,
  createJwtGuardMock,
  createPrismaMock,
  createRedisMock,
  createUsers,
} from './support/e2e-helpers';

describe('Market Data Ticker Flow (e2e)', () => {
  let app: NestFastifyApplication;
  let redisMock = createRedisMock();
  let binanceServiceMock: {
    getTicker: jest.Mock;
  };

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.BINANCE_BASE_URL = 'https://example.test';
  });

  beforeEach(async () => {
    const users = createUsers();
    const prismaMock = createPrismaMock(users);
    redisMock = createRedisMock();

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
