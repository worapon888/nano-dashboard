import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { TickerDto } from '../market-data/dto/ticker.dto';
import { CacheService } from '../redis/cache.service';
import WebSocket from 'ws';

type BinanceTickerResponse = {
  symbol?: string;
  lastPrice?: string;
  volume?: string;
  priceChange?: string;
  priceChangePercent?: string;
  highPrice?: string;
  lowPrice?: string;
};

export type BinanceKlineInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
export type PriceData = {
  symbol: string;
  price: string;
  fetchedAt: string;
  source: 'cache' | 'rest' | 'stream' | 'fallback';
  stale?: boolean;
};
export type BinanceKlineResponse = [
  openTime: number,
  openPrice: string,
  highPrice: string,
  lowPrice: string,
  closePrice: string,
  volume: string,
  closeTime: number,
  quoteAssetVolume: string,
  numberOfTrades: number,
  takerBuyBaseAssetVolume: string,
  takerBuyQuoteAssetVolume: string,
  ignore: string,
];

const BINANCE_REQUEST_TIMEOUT_MS = 5000;
const BINANCE_MAX_ATTEMPTS = 4;
const BINANCE_PRICE_CACHE_TTL_SECONDS = 30;
const BINANCE_PRICE_RECONNECT_BASE_DELAY_MS = 1000;
const BINANCE_PRICE_RECONNECT_MAX_DELAY_MS = 30000;
const DEFAULT_BINANCE_WS_BASE_URL = 'wss://stream.binance.com:9443/ws';

const RETRYABLE_HTTP_STATUS_CODES = new Set([429, 502, 503, 504]);
const NON_RETRYABLE_HTTP_STATUS_CODES = new Set([400, 403, 418]);

const RETRYABLE_NETWORK_CODES = new Set([
  'ECONNABORTED',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
]);

export class BinanceUnavailableException extends ServiceUnavailableException {
  constructor(message = 'Binance market data is temporarily unavailable') {
    super(message);
  }
}

@Injectable()
export class BinanceService implements OnModuleDestroy {
  private readonly baseUrl: string;
  private readonly wsBaseUrl: string;
  private readonly logger = new Logger(BinanceService.name);
  private readonly subscriptions = new Map<
    string,
    {
      socket: WebSocket | null;
      reconnectTimer: NodeJS.Timeout | null;
      retryCount: number;
    }
  >();
  private readonly trackedSymbols = new Set<string>();

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    // Fail fast at startup when the upstream base URL is missing.
    this.baseUrl = this.configService.getOrThrow<string>('BINANCE_BASE_URL');
    this.wsBaseUrl =
      this.configService.get<string>('BINANCE_WS_BASE_URL') ??
      DEFAULT_BINANCE_WS_BASE_URL;
  }

  async onModuleDestroy(): Promise<void> {
    this.subscriptions.forEach((state) => {
      if (state.reconnectTimer) {
        clearTimeout(state.reconnectTimer);
      }

      if (state.socket) {
        state.socket.removeAllListeners();
        state.socket.close();
      }
    });

    this.subscriptions.clear();
  }

  async getPrice(symbol: string): Promise<PriceData> {
    const normalizedSymbol = symbol.toUpperCase();
    const cacheKey = this.getPriceCacheKey(normalizedSymbol);

    try {
      const cachedValue = await this.cacheService.get(cacheKey);

      if (cachedValue) {
        const parsed = this.parseCachedPriceData(cachedValue, normalizedSymbol);
        if (parsed) {
          return {
            ...parsed,
            source: parsed.source === 'stream' ? 'stream' : 'cache',
          };
        }
      }

      const payload = await this.requestWithRetry<{ symbol?: string; price?: string }>(
        normalizedSymbol,
        '/api/v3/ticker/price',
        { symbol: normalizedSymbol },
        'price',
      );

      const data: PriceData = {
        symbol: normalizedSymbol,
        price: this.toStringValue(payload.price) ?? '0',
        fetchedAt: new Date().toISOString(),
        source: 'rest',
      };

      await this.cacheService.set(
        cacheKey,
        JSON.stringify(data),
        BINANCE_PRICE_CACHE_TTL_SECONDS,
      );

      return data;
    } catch (error) {
      this.logger.error(
        `Binance price lookup failed for ${normalizedSymbol}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );

      return {
        symbol: normalizedSymbol,
        price: '0',
        fetchedAt: new Date().toISOString(),
        source: 'fallback',
        stale: true,
      };
    }
  }

  subscribeRealtime(symbol: string): void {
    const normalizedSymbol = symbol.toUpperCase();

    if (this.subscriptions.has(normalizedSymbol)) {
      return;
    }

    this.trackedSymbols.add(normalizedSymbol);
    this.subscriptions.set(normalizedSymbol, {
      socket: null,
      reconnectTimer: null,
      retryCount: 0,
    });

    this.connectRealtime(normalizedSymbol);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async refreshTrackedSymbols(): Promise<void> {
    const symbols = Array.from(this.trackedSymbols);

    await Promise.all(
      symbols.map(async (symbol) => {
        const price = await this.getPrice(symbol);

        if (price.source === 'fallback') {
          this.logger.warn(
            `Scheduled Binance refresh returned fallback data for ${symbol}`,
          );
        }
      }),
    );
  }

  async getTicker(symbol: string): Promise<TickerDto> {
    const normalizedSymbol = symbol.toUpperCase();

    try {
      const payload = await this.requestWithRetry<BinanceTickerResponse>(
        normalizedSymbol,
        '/api/v3/ticker/24hr',
        { symbol: normalizedSymbol },
        'ticker',
      );

      return this.toTickerDto(normalizedSymbol, payload);
    } catch (error) {
      this.logger.error(
        `Binance ticker fetch failed for ${normalizedSymbol}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );

      return {
        symbol: normalizedSymbol,
        price: '0',
        volume24h: null,
        priceChange24h: null,
        priceChange24hPercent: null,
        high24h: null,
        low24h: null,
        fetchedAt: new Date().toISOString(),
        source: 'fallback',
        stale: true,
      };
    }
  }

  async getKlines(
    symbol: string,
    interval: BinanceKlineInterval,
    limit: number,
  ): Promise<BinanceKlineResponse[]> {
    const normalizedSymbol = symbol.toUpperCase();
    const safeLimit =
      Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 1;

    try {
      return await this.requestWithRetry<BinanceKlineResponse[]>(
        normalizedSymbol,
        '/api/v3/klines',
        {
          symbol: normalizedSymbol,
          interval,
          limit: safeLimit,
        },
        `klines:${interval}`,
      );
    } catch (error) {
      this.logger.error(
        `Binance klines fetch failed for ${normalizedSymbol} (${interval}): ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );

      return [];
    }
  }

  private connectRealtime(symbol: string): void {
    const state = this.subscriptions.get(symbol);
    if (!state) {
      return;
    }

    const wsUrl = `${this.wsBaseUrl.replace(/\/$/, '')}/${symbol.toLowerCase()}@ticker`;
    this.logger.log(`Connecting Binance realtime stream: ${wsUrl}`);

    try {
      const socket = new WebSocket(wsUrl);
      state.socket = socket;

      socket.on('open', () => {
        state.retryCount = 0;
        this.logger.log(`Binance realtime stream connected for ${symbol}`);
      });

      socket.on('message', (rawMessage) => {
        void this.handleRealtimeMessage(symbol, rawMessage);
      });

      socket.on('error', (error) => {
        this.logger.warn(
          `Binance realtime stream error for ${symbol}: ${error.message}`,
        );
      });

      socket.on('close', (code, reason) => {
        const readableReason =
          typeof reason === 'string'
            ? reason
            : Buffer.isBuffer(reason)
              ? reason.toString('utf-8')
              : '';

        this.logger.warn(
          `Binance realtime stream closed for ${symbol} (code=${code}, reason=${readableReason || 'n/a'})`,
        );

        this.scheduleReconnect(symbol);
      });
    } catch (error) {
      this.logger.error(
        `Binance realtime stream setup failed for ${symbol}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      this.scheduleReconnect(symbol);
    }
  }

  private async handleRealtimeMessage(
    symbol: string,
    rawMessage: WebSocket.RawData,
  ): Promise<void> {
    try {
      const payload = JSON.parse(rawMessage.toString()) as {
        c?: string;
      };

      const data: PriceData = {
        symbol,
        price: this.toStringValue(payload.c) ?? '0',
        fetchedAt: new Date().toISOString(),
        source: 'stream',
      };

      await this.cacheService.set(
        this.getPriceCacheKey(symbol),
        JSON.stringify(data),
        BINANCE_PRICE_CACHE_TTL_SECONDS,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to process Binance realtime message for ${symbol}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private scheduleReconnect(symbol: string): void {
    const state = this.subscriptions.get(symbol);

    if (!state) {
      return;
    }

    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer);
    }

    state.retryCount += 1;
    const delayMs = Math.min(
      BINANCE_PRICE_RECONNECT_BASE_DELAY_MS * 2 ** (state.retryCount - 1),
      BINANCE_PRICE_RECONNECT_MAX_DELAY_MS,
    );

    this.logger.warn(
      `Scheduling Binance realtime reconnect for ${symbol} in ${delayMs}ms (retry ${state.retryCount})`,
    );

    state.reconnectTimer = setTimeout(() => {
      state.reconnectTimer = null;
      this.connectRealtime(symbol);
    }, delayMs);
  }

  private getPriceCacheKey(symbol: string): string {
    return `binance:price:${symbol}`;
  }

  private parseCachedPriceData(
    value: string,
    symbol: string,
  ): PriceData | null {
    try {
      const parsed = JSON.parse(value) as Partial<PriceData>;

      if (typeof parsed.price !== 'string') {
        return null;
      }

      return {
        symbol,
        price: parsed.price,
        fetchedAt:
          typeof parsed.fetchedAt === 'string'
            ? parsed.fetchedAt
            : new Date().toISOString(),
        source:
          parsed.source === 'stream' ||
          parsed.source === 'rest' ||
          parsed.source === 'cache' ||
          parsed.source === 'fallback'
            ? parsed.source
            : 'cache',
        stale: parsed.stale === true,
      };
    } catch {
      return null;
    }
  }

  private toTickerDto(
    normalizedSymbol: string,
    payload: BinanceTickerResponse,
  ): TickerDto {
    return {
      symbol: normalizedSymbol,
      price: this.toStringValue(payload.lastPrice) ?? '0',
      volume24h: this.toStringValue(payload.volume),
      priceChange24h: this.toStringValue(payload.priceChange),
      priceChange24hPercent: this.toStringValue(payload.priceChangePercent),
      high24h: this.toStringValue(payload.highPrice),
      low24h: this.toStringValue(payload.lowPrice),
      fetchedAt: new Date().toISOString(),
      source: 'binance',
    };
  }

  private async requestWithRetry<TResponse>(
    normalizedSymbol: string,
    path: string,
    params: Record<string, string | number>,
    requestLabel: string,
  ): Promise<TResponse> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= BINANCE_MAX_ATTEMPTS; attempt++) {
      try {
        const response = await firstValueFrom(
          this.httpService.get<TResponse>(`${this.baseUrl}${path}`, {
            params,
            timeout: BINANCE_REQUEST_TIMEOUT_MS,
          }),
        );

        return response.data;
      } catch (error) {
        lastError = error;

        if (!this.shouldRetry(error) || attempt === BINANCE_MAX_ATTEMPTS) {
          break;
        }

        const delayMs = this.getRetryDelayMs(attempt);
        const axiosError = error as AxiosError | undefined;
        const detail =
          axiosError?.response?.status ?? axiosError?.code ?? 'unknown';

        this.logger.warn(
          `Retrying Binance ${requestLabel} fetch for ${normalizedSymbol} (attempt ${attempt}, detail ${detail})`,
        );

        await this.sleep(delayMs);
      }
    }

    const unavailableException = this.toUnavailableException(
      normalizedSymbol,
      lastError,
      requestLabel,
    );

    throw unavailableException;
  }

  private shouldRetry(error: unknown): boolean {
    const axiosError = error as AxiosError | undefined;

    const statusCode = axiosError?.response?.status;
    if (statusCode && NON_RETRYABLE_HTTP_STATUS_CODES.has(statusCode)) {
      return false;
    }

    if (statusCode && RETRYABLE_HTTP_STATUS_CODES.has(statusCode)) {
      return true;
    }

    const errorCode = axiosError?.code;
    return Boolean(errorCode && RETRYABLE_NETWORK_CODES.has(errorCode));
  }

  private getRetryDelayMs(attempt: number): number {
    const baseDelay = 200 * 2 ** (attempt - 1);
    const jitter = Math.floor(Math.random() * 100);
    return baseDelay + jitter;
  }

  private toUnavailableException(
    normalizedSymbol: string,
    error: unknown,
    requestLabel = 'request',
  ): BinanceUnavailableException {
    const axiosError = error as AxiosError | undefined;

    const statusCode = axiosError?.response?.status;
    const errorCode = axiosError?.code;

    const detail = statusCode
      ? `status ${statusCode}`
      : (errorCode ?? 'unknown');

    this.logger.error(
      `Binance ${requestLabel} fetch failed for ${normalizedSymbol}: ${detail}`,
      axiosError?.stack,
    );

    return new BinanceUnavailableException(
      `Binance ${requestLabel} fetch failed for ${normalizedSymbol}`,
    );
  }

  private toStringValue(value: string | undefined): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    return String(value);
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
