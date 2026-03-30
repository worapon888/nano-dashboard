import { ServiceUnavailableException } from '@nestjs/common';
import {
  BinanceService,
  BinanceUnavailableException,
} from '../binance/binance.service';
import { CacheService } from '../cache/cache.service';
import { TickerDto } from './dto/ticker.dto';
import { MarketDataService } from './market-data.service';

describe('MarketDataService', () => {
  let service: MarketDataService;
  let cacheService: jest.Mocked<CacheService>;
  let binanceService: jest.Mocked<BinanceService>;

  const ticker: TickerDto = {
    symbol: 'BTCUSDT',
    price: '65000.12',
    volume24h: '12345.67',
    priceChange24h: '2.34',
    high24h: '66000.00',
    low24h: '64000.00',
    fetchedAt: '2026-03-30T00:00:00.000Z',
    source: 'binance',
  };

  beforeEach(() => {
    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      publish: jest.fn(),
      setNx: jest.fn(),
      subscribeOnce: jest.fn(),
    } as unknown as jest.Mocked<CacheService>;

    binanceService = {
      getTicker: jest.fn(),
    } as unknown as jest.Mocked<BinanceService>;

    service = new MarketDataService(binanceService, cacheService);
  });

  it('returns immediately from hot cache', async () => {
    cacheService.get.mockResolvedValueOnce(ticker);

    await expect(service.getTicker('btcusdt')).resolves.toEqual(ticker);
    expect(binanceService.getTicker).not.toHaveBeenCalled();
  });

  it('fetches from Binance on cold cache and writes hot and stale cache', async () => {
    cacheService.get.mockResolvedValueOnce(null);
    cacheService.setNx.mockResolvedValueOnce(true);
    binanceService.getTicker.mockResolvedValueOnce(ticker);
    cacheService.set.mockResolvedValue();
    cacheService.del.mockResolvedValue();
    cacheService.publish.mockResolvedValue();

    await expect(service.getTicker('btcusdt')).resolves.toEqual(ticker);

    expect(binanceService.getTicker).toHaveBeenCalledWith('BTCUSDT');
    expect(cacheService.set).toHaveBeenNthCalledWith(
      1,
      'app:ticker:BTCUSDT',
      ticker,
      2,
    );
    expect(cacheService.set).toHaveBeenNthCalledWith(
      2,
      'app:ticker:BTCUSDT:stale',
      ticker,
      120,
    );
    expect(cacheService.publish).toHaveBeenCalledWith(
      'app:ch:ticker:BTCUSDT',
      ticker,
    );
  });

  it('returns stale cache when Binance fetch fails and stale exists', async () => {
    cacheService.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...ticker, stale: true });
    cacheService.setNx.mockResolvedValueOnce(true);
    binanceService.getTicker.mockRejectedValueOnce(
      new BinanceUnavailableException(),
    );
    cacheService.del.mockResolvedValue();

    await expect(service.getTicker('BTCUSDT')).resolves.toEqual({
      ...ticker,
      stale: true,
    });
  });

  it('waits for the fetcher publish when lock is already held', async () => {
    cacheService.get.mockResolvedValueOnce(null);
    cacheService.setNx.mockResolvedValueOnce(false);
    cacheService.subscribeOnce.mockResolvedValueOnce(ticker);

    await expect(service.getTicker('BTCUSDT')).resolves.toEqual(ticker);
    expect(binanceService.getTicker).not.toHaveBeenCalled();
    expect(cacheService.subscribeOnce).toHaveBeenCalledWith(
      'app:ch:ticker:BTCUSDT',
      6000,
    );
  });

  it('falls back to stale cache when waiter times out', async () => {
    cacheService.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...ticker, stale: false });
    cacheService.setNx.mockResolvedValueOnce(false);
    cacheService.subscribeOnce.mockResolvedValueOnce(null);

    await expect(service.getTicker('BTCUSDT')).resolves.toEqual({
      ...ticker,
      stale: true,
    });
  });

  it('throws 503 when no fresh or stale data is available', async () => {
    cacheService.get.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    cacheService.setNx.mockResolvedValueOnce(true);
    binanceService.getTicker.mockRejectedValueOnce(
      new BinanceUnavailableException(),
    );
    cacheService.del.mockResolvedValue();

    await expect(service.getTicker('BTCUSDT')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
