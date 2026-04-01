import { ServiceUnavailableException } from '@nestjs/common';
import {
  BinanceService,
  BinanceUnavailableException,
} from '../binance/binance.service';
import { RedisService } from '../redis/redis.service';
import { TickerDto } from './dto/ticker.dto';
import { MarketDataService } from './market-data.service';

describe('MarketDataService', () => {
  let service: MarketDataService;
  let redisService: jest.Mocked<RedisService>;
  let binanceService: jest.Mocked<BinanceService>;

  const ticker: TickerDto = {
    symbol: 'BTCUSDT',
    price: '65000.12',
    volume24h: '12345.67',
    priceChange24h: '2.34',
    priceChange24hPercent: '3.21',
    high24h: '66000.00',
    low24h: '64000.00',
    fetchedAt: '2026-03-30T00:00:00.000Z',
    source: 'binance',
  };

  beforeEach(() => {
    redisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      publish: jest.fn(),
      setNx: jest.fn(),
      subscribeOnce: jest.fn(),
    } as unknown as jest.Mocked<RedisService>;

    binanceService = {
      getTicker: jest.fn(),
      getKlines: jest.fn(),
    } as unknown as jest.Mocked<BinanceService>;

    service = new MarketDataService(binanceService, redisService);
  });

  it('returns immediately from hot cache', async () => {
    redisService.get.mockResolvedValueOnce(ticker);

    await expect(service.getTicker('btcusdt')).resolves.toMatchObject({
      ...ticker,
      cacheSource: 'hot',
    });
    expect(binanceService.getTicker).not.toHaveBeenCalled();
  });

  it('fetches from Binance on cold cache and writes hot and stale cache', async () => {
    redisService.get.mockResolvedValueOnce(null);
    redisService.setNx.mockResolvedValueOnce(true);
    binanceService.getTicker.mockResolvedValueOnce(ticker);
    redisService.set.mockResolvedValue();
    redisService.del.mockResolvedValue();
    redisService.publish.mockResolvedValue();

    await expect(service.getTicker('btcusdt')).resolves.toMatchObject({
      ...ticker,
      cacheSource: 'fresh',
    });

    expect(binanceService.getTicker).toHaveBeenCalledWith('BTCUSDT');
    expect(redisService.set).toHaveBeenNthCalledWith(
      1,
      'app:ticker:BTCUSDT:hot',
      ticker,
      10,
    );
    expect(redisService.set).toHaveBeenNthCalledWith(
      2,
      'app:ticker:BTCUSDT:stale',
      ticker,
      120,
    );
    expect(redisService.publish).toHaveBeenCalledWith(
      'app:ch:ticker:BTCUSDT',
      ticker,
    );
  });

  it('returns stale cache when Binance fetch fails and stale exists', async () => {
    redisService.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...ticker, stale: true });
    redisService.setNx.mockResolvedValueOnce(true);
    binanceService.getTicker.mockRejectedValueOnce(
      new BinanceUnavailableException(),
    );
    redisService.del.mockResolvedValue();

    await expect(service.getTicker('BTCUSDT')).resolves.toMatchObject({
      ...ticker,
      cacheSource: 'stale',
      stale: true,
    });
  });

  it('waits for the fetcher publish when lock is already held', async () => {
    redisService.get.mockResolvedValueOnce(null);
    redisService.setNx.mockResolvedValueOnce(false);
    redisService.subscribeOnce.mockResolvedValueOnce(ticker);

    await expect(service.getTicker('BTCUSDT')).resolves.toMatchObject({
      ...ticker,
      cacheSource: 'fresh',
    });
    expect(binanceService.getTicker).not.toHaveBeenCalled();
    expect(redisService.subscribeOnce).toHaveBeenCalledWith(
      'app:ch:ticker:BTCUSDT',
      6000,
    );
  });

  it('re-checks hot cache before subscribing when lock is already held', async () => {
    redisService.get.mockResolvedValueOnce(null).mockResolvedValueOnce(ticker);
    redisService.setNx.mockResolvedValueOnce(false);

    await expect(service.getTicker('BTCUSDT')).resolves.toMatchObject({
      ...ticker,
      cacheSource: 'hot',
    });

    expect(redisService.subscribeOnce).not.toHaveBeenCalled();
    expect(binanceService.getTicker).not.toHaveBeenCalled();
  });

  it('re-checks hot cache after a missed publish before falling back to stale', async () => {
    redisService.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(ticker);
    redisService.setNx.mockResolvedValueOnce(false);
    redisService.subscribeOnce.mockResolvedValueOnce(null);

    await expect(service.getTicker('BTCUSDT')).resolves.toMatchObject({
      ...ticker,
      cacheSource: 'hot',
    });
  });

  it('falls back to stale cache when waiter times out', async () => {
    redisService.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...ticker, stale: false });
    redisService.setNx.mockResolvedValueOnce(false);
    redisService.subscribeOnce.mockResolvedValueOnce(null);

    await expect(service.getTicker('BTCUSDT')).resolves.toMatchObject({
      ...ticker,
      cacheSource: 'stale',
      stale: true,
    });
  });

  it('throws 503 when no fresh or stale data is available', async () => {
    redisService.get.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    redisService.setNx.mockResolvedValueOnce(true);
    binanceService.getTicker.mockRejectedValueOnce(
      new BinanceUnavailableException(),
    );
    redisService.del.mockResolvedValue();

    await expect(service.getTicker('BTCUSDT')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('builds a BTC price trend payload from ticker and klines', async () => {
    redisService.get.mockResolvedValueOnce(ticker);
    binanceService.getKlines.mockResolvedValueOnce([
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
    ]);

    await expect(service.getBtcPriceTrend('day')).resolves.toMatchObject({
      range: 'day',
      currency: 'USD',
      livePrice: 65000.12,
      change24h: 2.34,
      change24hPercent: 3.21,
      series: [67240, 67680],
      high: 67680,
      low: 67240,
      updatedAt: ticker.fetchedAt,
    });

    expect(binanceService.getKlines).toHaveBeenCalledWith('BTCUSDT', '1h', 24);
  });

  it('builds dashboard market overview and market share from tracked tickers', () => {
    const composition = service.buildDashboardMarketComposition([
      {
        symbol: 'BTCUSDT',
        price: '68000',
        volume24h: '120000',
        priceChange24h: '800',
        high24h: '69000',
        low24h: '66000',
        fetchedAt: '2026-04-01T09:00:00.000Z',
      },
      {
        symbol: 'ETHUSDT',
        price: '3200',
        volume24h: '500000',
        priceChange24h: '60',
        high24h: '3250',
        low24h: '3100',
        fetchedAt: '2026-04-01T09:00:00.000Z',
      },
      {
        symbol: 'SOLUSDT',
        price: '180',
        volume24h: '900000',
        priceChange24h: '-3',
        high24h: '184',
        low24h: '176',
        fetchedAt: '2026-04-01T09:00:00.000Z',
      },
    ]);

    expect(composition.marketOverview.btcDominance).toBeGreaterThan(0);
    expect(composition.marketOverview.btcDominance).toBeLessThanOrEqual(100);
    expect(composition.marketOverview.fearGreedIndex).toBeGreaterThanOrEqual(0);
    expect(composition.marketOverview.fearGreedIndex).toBeLessThanOrEqual(100);
    expect(composition.marketShare).toEqual([
      expect.objectContaining({ symbol: 'BTC' }),
      expect.objectContaining({ symbol: 'ETH' }),
      expect.objectContaining({ symbol: 'OTHERS' }),
    ]);
  });

  it('fetches tracked tickers from the ticker pipeline when cache entries are missing', async () => {
    const btcTicker: TickerDto = {
      ...ticker,
      symbol: 'BTCUSDT',
    };
    const ethTicker: TickerDto = {
      ...ticker,
      symbol: 'ETHUSDT',
      price: '3200.10',
      volume24h: '2500000',
      priceChange24h: '40.5',
      high24h: '3250.00',
      low24h: '3100.00',
    };

    redisService.get.mockResolvedValue(null);
    redisService.setNx.mockResolvedValue(true);
    binanceService.getTicker
      .mockResolvedValueOnce(btcTicker)
      .mockResolvedValueOnce(ethTicker);
    redisService.set.mockResolvedValue();
    redisService.del.mockResolvedValue();
    redisService.publish.mockResolvedValue();

    const trackedTickers = await service.getTrackedTickers(2);

    expect(binanceService.getTicker).toHaveBeenNthCalledWith(1, 'BTCUSDT');
    expect(binanceService.getTicker).toHaveBeenNthCalledWith(2, 'ETHUSDT');
    expect(trackedTickers).toEqual([
      expect.objectContaining({ symbol: 'BTCUSDT', price: '65000.12' }),
      expect.objectContaining({ symbol: 'ETHUSDT', price: '3200.10' }),
    ]);
  });
});
