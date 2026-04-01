import { ConfigService } from '@nestjs/config';
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

    marketEventsPublisher = {
      publishTicker: jest.fn(),
    };

    service = new BtcPriceLiveService(
      configService,
      marketEventsPublisher,
    );
  });

  afterEach(() => {
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
});
