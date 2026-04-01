import { ConfigService } from '@nestjs/config';
import { BinanceService } from '../binance/binance.service';
import { BtcPriceLiveService } from './btc-price-live.service';

type TestSocket = {
  url: string;
  on(event: string, listener: (...args: unknown[]) => void): TestSocket;
  removeAllListeners(): TestSocket;
  close(): void;
  emit(event: string, ...args: unknown[]): void;
};

const mockWebSocketState: { instances: TestSocket[] } = {
  instances: [],
};

jest.mock('ws', () => {
  class MockedWebSocket {
    private readonly listeners = new Map<string, Set<(...args: unknown[]) => void>>();

    constructor(public readonly url: string) {
      mockWebSocketState.instances.push(this as unknown as TestSocket);
    }

    on(event: string, listener: (...args: unknown[]) => void): this {
      const listeners = this.listeners.get(event) ?? new Set();
      listeners.add(listener);
      this.listeners.set(event, listeners);
      return this;
    }

    removeAllListeners(): this {
      this.listeners.clear();
      return this;
    }

    close(): void {
      this.emit('close', 1000, Buffer.from('client-close'));
    }

    emit(event: string, ...args: unknown[]): void {
      for (const listener of this.listeners.get(event) ?? []) {
        listener(...args);
      }
    }
  }

  return {
    __esModule: true,
    default: MockedWebSocket,
  };
});

describe('BtcPriceLiveService', () => {
  let service: BtcPriceLiveService;
  let configService: ConfigService;
  let binanceService: { getTicker: jest.Mock };
  let marketEventsPublisher: { publishTicker: jest.Mock };

  beforeEach(() => {
    jest.useFakeTimers();
    mockWebSocketState.instances = [];

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'BINANCE_WS_BASE_URL') {
          return 'wss://stream.binance.com:9443/ws';
        }

        if (key === 'BINANCE_LIVE_STREAM_ENABLED') {
          return 'true';
        }

        return undefined;
      }),
    } as unknown as ConfigService;

    binanceService = {
      getTicker: jest.fn().mockResolvedValue({
        symbol: 'BTCUSDT',
        price: '64000',
        priceChange24h: '100',
        priceChange24hPercent: '0.15',
        high24h: '64500',
        low24h: '63500',
        fetchedAt: '2026-04-01T00:00:00.000Z',
      }),
    };

    marketEventsPublisher = {
      publishTicker: jest.fn(),
    };

    service = new BtcPriceLiveService(
      configService,
      binanceService as unknown as BinanceService,
      marketEventsPublisher,
    );
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('reconnects after the current socket closes and ignores stale close events', () => {
    service['connect']();

    const firstSocket = mockWebSocketState.instances[0];
    expect(firstSocket.url).toContain('btcusdt@ticker');

    firstSocket.emit('open');
    firstSocket.emit('close', 1006, Buffer.from('network-drop'));

    jest.advanceTimersByTime(1000);

    expect(mockWebSocketState.instances).toHaveLength(2);

    const secondSocket = mockWebSocketState.instances[1];
    secondSocket.emit('open');
    firstSocket.emit('close', 1006, Buffer.from('stale-close'));

    jest.advanceTimersByTime(30000);

    expect(mockWebSocketState.instances).toHaveLength(2);
    expect(service['socket']).toBe(secondSocket);
  });

  it('activates REST fallback polling when websocket handshake returns HTTP 451', async () => {
    binanceService.getTicker.mockResolvedValue({
      symbol: 'BTCUSDT',
      price: '64000.5',
      priceChange24h: '120.4',
      priceChange24hPercent: '0.18',
      high24h: '65000',
      low24h: '63000',
      fetchedAt: '2026-04-01T00:00:00.000Z',
    });

    service['connect']();

    const firstSocket = mockWebSocketState.instances[0];
    firstSocket.emit('error', new Error('Unexpected server response: 451'));
    await Promise.resolve();
    await Promise.resolve();

    expect(service['isFallbackActive']).toBe(true);
    expect(binanceService.getTicker).toHaveBeenCalledWith('BTCUSDT');
    expect(marketEventsPublisher.publishTicker).toHaveBeenCalledWith(
      'btc.price.updated',
      expect.objectContaining({
        symbol: 'BTCUSDT',
        price: 64000.5,
      }),
    );
  });
});
