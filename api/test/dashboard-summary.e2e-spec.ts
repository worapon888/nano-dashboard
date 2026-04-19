import { Test, TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { BinanceService } from '../src/binance/binance.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { MarketDataService } from '../src/market-data/market-data.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import {
  applyCommonAppSetup,
  createJwtGuardMock,
  createPrismaMock,
  createRedisMock,
  createUsers,
} from './support/e2e-helpers';

describe('Dashboard Summary (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  beforeEach(async () => {
    const users = createUsers();
    const prismaMock = createPrismaMock(users);
    const redisMock = createRedisMock();

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

  it('returns 200 with stable response shape for GET /api/dashboard/summary', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/dashboard/summary')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Dashboard summary retrieved successfully');

    const { data } = response.body;

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

    expect(data.health).toHaveProperty('db');
    expect(data.health).toHaveProperty('redis');
    expect(data.health).toHaveProperty('wsConnections');

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
