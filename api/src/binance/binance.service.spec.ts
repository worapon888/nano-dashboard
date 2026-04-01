import { HttpService } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
import { CacheService } from '../redis/cache.service';
import { BinanceService } from './binance.service';

const mockWebSocketInstances: Array<{
  url: string;
  readyState: number;
  handlers: Map<string, Array<(...args: any[]) => void>>;
  removeAllListeners: jest.Mock;
  close: jest.Mock;
  on: (event: string, handler: (...args: any[]) => void) => unknown;
  emit: (event: string, ...args: any[]) => void;
}> = [];

jest.mock('ws', () => {
  class MockedWebSocket {
    static OPEN = 1;

    public readyState = MockedWebSocket.OPEN;
    public handlers = new Map<string, Array<(...args: any[]) => void>>();
    public removeAllListeners = jest.fn();
    public close = jest.fn();
    public url: string;

    constructor(url: string) {
      this.url = url;
      mockWebSocketInstances.push(this);
    }

    on(event: string, handler: (...args: any[]) => void) {
      const existing = this.handlers.get(event) ?? [];
      existing.push(handler);
      this.handlers.set(event, existing);
      return this;
    }

    emit(event: string, ...args: any[]) {
      const handlers = this.handlers.get(event) ?? [];
      handlers.forEach((handler) => handler(...args));
    }
  }

  return {
    __esModule: true,
    default: MockedWebSocket,
  };
});

describe('BinanceService', () => {
  let service: BinanceService;
  let httpService: { get: jest.Mock };
  let cacheService: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    jest.useFakeTimers();
    mockWebSocketInstances.length = 0;

    httpService = {
      get: jest.fn(),
    };
    cacheService = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BinanceService,
        {
          provide: HttpService,
          useValue: httpService,
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('https://api.binance.com'),
            get: jest.fn().mockReturnValue('wss://stream.binance.com:9443/ws'),
          },
        },
        {
          provide: CacheService,
          useValue: cacheService,
        },
      ],
    }).compile();

    service = module.get(BinanceService);
  });

  afterEach(async () => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    await service.onModuleDestroy();
    jest.clearAllMocks();
  });

  it('getPrice() cache hit should not call fetch', async () => {
    cacheService.get.mockResolvedValue(
      JSON.stringify({
        symbol: 'BTCUSDT',
        price: '68000.10',
        fetchedAt: '2026-04-01T12:00:00.000Z',
        source: 'stream',
      }),
    );

    const result = await service.getPrice('btcusdt');

    expect(result).toEqual({
      symbol: 'BTCUSDT',
      price: '68000.10',
      fetchedAt: '2026-04-01T12:00:00.000Z',
      source: 'stream',
      stale: false,
    });
    expect(httpService.get).not.toHaveBeenCalled();
  });

  it('getPrice() cache miss should fetch and set cache', async () => {
    cacheService.get.mockResolvedValue(null);
    httpService.get.mockReturnValue(
      of({
        data: {
          symbol: 'BTCUSDT',
          price: '68123.45',
        },
      }),
    );

    const result = await service.getPrice('BTCUSDT');

    expect(result.symbol).toBe('BTCUSDT');
    expect(result.price).toBe('68123.45');
    expect(result.source).toBe('rest');
    expect(httpService.get).toHaveBeenCalledTimes(1);
    expect(cacheService.set).toHaveBeenCalledWith(
      'binance:price:BTCUSDT',
      expect.any(String),
      30,
    );
  });

  it('reconnect logic retries when websocket errors/closes', async () => {
    service.subscribeRealtime('BTCUSDT');

    expect(mockWebSocketInstances).toHaveLength(1);
    const firstSocket = mockWebSocketInstances[0];

    firstSocket.emit('error', new Error('socket failed'));
    firstSocket.emit('close', 1006, Buffer.from('socket failed'));

    await jest.advanceTimersByTimeAsync(1000);

    expect(mockWebSocketInstances).toHaveLength(2);
    expect(mockWebSocketInstances[1].url).toBe(
      'wss://stream.binance.com:9443/ws/btcusdt@ticker',
    );
  });
});
