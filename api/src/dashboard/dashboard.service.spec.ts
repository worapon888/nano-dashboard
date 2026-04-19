import { DashboardService } from './dashboard.service';

describe('DashboardService retry/timeout/fallback policy', () => {
  const createService = () => {
    const usersService = {
      getActiveCount: jest.fn().mockResolvedValue(3),
    };

    const binanceService = {
      getPrice: jest.fn(),
    };

    const marketDataService = {
      getTrackedTickers: jest.fn().mockResolvedValue([
        {
          symbol: 'BTCUSDT',
          price: '68140',
          volume24h: '1000000',
          priceChange24h: '900',
          high24h: '68140',
          low24h: '67240',
          fetchedAt: '2026-04-01T09:00:00.000Z',
        },
        {
          symbol: 'ETHUSDT',
          price: '3200',
          volume24h: '2500000',
          priceChange24h: '40',
          high24h: '3240',
          low24h: '3120',
          fetchedAt: '2026-04-01T09:00:00.000Z',
        },
      ]),
      buildDashboardMarketComposition: jest.fn().mockReturnValue({
        marketOverview: {
          btcDominance: 89.48,
          fearGreedIndex: 69,
        },
        marketShare: [
          { symbol: 'BTC', dominance: 89.48 },
          { symbol: 'ETH', dominance: 10.52 },
          { symbol: 'OTHERS', dominance: 0 },
        ],
      }),
      getDashboardBtcPriceTrend: jest.fn().mockResolvedValue({
        range: '1h',
        currency: 'USD',
        livePrice: 68140,
        change24h: 900,
        change24hPercent: 1.34,
        labels: ['09:00'],
        series: [67680],
        high: 67680,
        low: 67680,
        updatedAt: '2026-04-01T09:00:00.000Z',
      }),
      getDashboardVolumeProfile: jest.fn().mockResolvedValue({
        timeframe: '1h',
        labels: ['09:00'],
        volume: [120],
        colors: ['#22c55e'],
        updatedAt: '2026-04-01T09:00:00.000Z',
      }),
    };

    const ordersService = {
      getOpenOrders: jest.fn().mockResolvedValue({
        activeCount: 1,
        totalCount: 1,
        items: [
          {
            id: 'order-1',
            pair: 'BTC/USDT',
            side: 'BUY',
            type: 'Limit',
            price: 68000,
            amount: 0.1,
            filledPercent: 0,
            totalUsd: 6800,
            status: 'Open',
            createdAtLabel: 'Apr 1, 09:00',
          },
        ],
        updatedAt: '2026-04-01T09:00:00.000Z',
      }),
    };

    const pnlService = {
      getWeeklyPnl: jest.fn().mockResolvedValue({
        range: 'week',
        weeklyNet: 1780,
        series: [
          { day: 'Mon', value: 540 },
          { day: 'Tue', value: -220 },
        ],
        stats: {
          best: 540,
          worst: -220,
          avg: 160,
          win: 1,
          loss: 1,
        },
        updatedAt: '2026-04-01T09:00:00.000Z',
      }),
    };

    const redisService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const internalService = {
      getQuickHealth: jest.fn().mockResolvedValue({
        db: 'up',
        redis: 'up',
        wsConnections: 1,
      }),
    };

    const service = new DashboardService(
      usersService as never,
      binanceService as never,
      marketDataService as never,
      ordersService as never,
      pnlService as never,
      redisService as never,
      internalService as never,
    );

    return {
      service,
      mocks: {
        usersService,
        binanceService,
        marketDataService,
        ordersService,
        pnlService,
        redisService,
        internalService,
      },
    };
  };

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('returns an empty daily pnl section with a warning when pnl loading fails', async () => {
    const { service, mocks } = createService();
    mocks.pnlService.getWeeklyPnl.mockRejectedValueOnce(new Error('db unavailable'));

    const summary = await service.getSummary('user-1', '1h', '1h', 'week');

    expect(summary.warnings).toContain('daily_pnl_unavailable');
    expect(summary.dailyPnl.series).toEqual([]);
    expect(summary.dailyPnl.weeklyNet).toBe(0);
  });

  it('times out a slow section and falls back to an empty open orders state', async () => {
    jest.useFakeTimers();

    const { service, mocks } = createService();
    mocks.ordersService.getOpenOrders.mockImplementationOnce(
      () => new Promise(() => undefined),
    );

    const summaryPromise = service.getSummary('user-1', '1h', '1h', 'week');

    await jest.advanceTimersByTimeAsync(7000);

    const summary = await summaryPromise;

    expect(summary.warnings).toContain('open_orders_unavailable');
    expect(summary.openOrders.items).toEqual([]);
    expect(summary.openOrders.totalCount).toBe(0);
  });

  it('falls back to a default market overview when market composition cannot be built', async () => {
    const { service, mocks } = createService();
    mocks.marketDataService.buildDashboardMarketComposition.mockImplementationOnce(() => {
      throw new Error('missing BTC ticker');
    });

    const summary = await service.getSummary('user-1', '1h', '1h', 'week');

    expect(summary.warnings).toContain('market_overview_unavailable');
    expect(summary.marketOverview).toEqual({
      btcDominance: 0,
      fearGreedIndex: 50,
    });
    expect(summary.marketShare).toEqual([
      { symbol: 'BTC', dominance: 0 },
      { symbol: 'ETH', dominance: 0 },
      { symbol: 'OTHERS', dominance: 100 },
    ]);
  });
});
