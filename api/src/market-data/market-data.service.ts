import {
  Inject,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  BinanceService,
  BinanceUnavailableException,
} from '../binance/binance.service';
import { CacheService } from '../cache/cache.service';
import { MARKET_EVENTS_PUBLISHER } from '../events/events.tokens';
import type { MarketEventsPublisher } from '../events/events.tokens';
import { TickerDto } from './dto/ticker.dto';

const HOT_CACHE_TTL_SECONDS = 10;
const STALE_CACHE_TTL_SECONDS = 120;
const LOCK_TTL_SECONDS = 5;
const WAITER_TIMEOUT_MS = 6000;

type DashboardTickerDto = {
  symbol: string;
  price: string;
  volume24h: string | null;
  priceChange24h: string | null;
  high24h: string | null;
  low24h: string | null;
  fetchedAt: string;
};

/**
 * The default symbol list used for the dashboard tracked-symbols panel.
 * Only symbols that have been fetched at least once (and therefore have a
 * hot or stale cache entry) will appear in the result. The list is ordered
 * by the priority we want to display them in.
 */
const DEFAULT_MOVER_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'BNBUSDT',
  'XRPUSDT',
];

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);

  constructor(
    private readonly binanceService: BinanceService,
    private readonly cacheService: CacheService,
    @Optional()
    @Inject(MARKET_EVENTS_PUBLISHER)
    private readonly marketEventsPublisher?: MarketEventsPublisher,
  ) {}

  async getTrackedTickers(limit: number): Promise<DashboardTickerDto[]> {
    const safeLimit =
      Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 5;

    const symbols = DEFAULT_MOVER_SYMBOLS.slice(0, safeLimit);

    const results = await Promise.allSettled(
      symbols.map(async (symbol): Promise<DashboardTickerDto | null> => {
        // Prefer the hot cache; fall back to stale so the dashboard still
        // shows data during periods when Binance is unreachable.
        const hot = await this.cacheService.get<TickerDto>(
          this.getHotCacheKey(symbol),
        );
        if (hot) return this.toDashboardTickerDto(hot);

        const stale = await this.cacheService.get<TickerDto>(
          this.getStaleCacheKey(symbol),
        );
        if (stale) return this.toDashboardTickerDto(stale);

        return null;
      }),
    );

    return results
      .filter(
        (r): r is PromiseFulfilledResult<DashboardTickerDto> =>
          r.status === 'fulfilled' && r.value !== null,
      )
      .map((r) => r.value);
  }

  private toDashboardTickerDto(ticker: TickerDto): DashboardTickerDto {
    return {
      symbol: ticker.symbol,
      price: ticker.price,
      volume24h: ticker.volume24h ?? null,
      priceChange24h: ticker.priceChange24h ?? null,
      high24h: ticker.high24h ?? null,
      low24h: ticker.low24h ?? null,
      fetchedAt: ticker.fetchedAt,
    };
  }

  async getTicker(symbol: string): Promise<TickerDto> {
    const normalizedSymbol = this.normalizeSymbol(symbol);
    const hotCacheKey = this.getHotCacheKey(normalizedSymbol);
    const cachedTicker = await this.cacheService.get<TickerDto>(hotCacheKey);

    if (cachedTicker) {
      this.logger.log(`Ticker hot cache hit for ${normalizedSymbol}`);
      await this.backfillStaleCacheIfMissing(normalizedSymbol, cachedTicker);
      return this.withCacheSource(cachedTicker, 'hot');
    }

    this.logger.log(`Ticker hot cache miss for ${normalizedSymbol}`);

    const lockKey = this.getLockKey(normalizedSymbol);
    const lockValue = `${process.pid}:${Date.now()}`;
    const lockAcquired = await this.cacheService.setNx(
      lockKey,
      lockValue,
      LOCK_TTL_SECONDS,
    );

    if (lockAcquired) {
      this.logger.log(`Ticker lock acquired for ${normalizedSymbol}`);
      return this.fetchAndCacheTicker(normalizedSymbol, hotCacheKey, lockKey);
    }

    this.logger.log(`Ticker waiter subscribed for ${normalizedSymbol}`);
    return this.waitForFetcherOrFallback(normalizedSymbol, hotCacheKey);
  }

  private async fetchAndCacheTicker(
    symbol: string,
    hotCacheKey: string,
    lockKey: string,
  ): Promise<TickerDto> {
    const channel = this.getChannelKey(symbol);
    const ticker = await this.getTickerFromBinanceOrFallback(symbol);

    if (this.isStaleTicker(ticker)) {
      await this.cacheService.del(lockKey);
      return ticker;
    }

    try {
      await this.writeTickerCaches(symbol, hotCacheKey, ticker);
    } finally {
      await this.cacheService.del(lockKey);
    }

    await this.publishTickerUpdate(symbol, channel, ticker);
    await this.broadcastFetcherUpdate(symbol, ticker);

    return this.withCacheSource(ticker, 'fresh');
  }

  private async waitForFetcherOrFallback(
    symbol: string,
    hotCacheKey: string,
  ): Promise<TickerDto> {
    const channel = this.getChannelKey(symbol);

    const hotTicker = await this.cacheService.get<TickerDto>(hotCacheKey);
    if (hotTicker) {
      this.logger.log(`Ticker hot cache won race for ${symbol}`);
      await this.backfillStaleCacheIfMissing(symbol, hotTicker);
      return this.withCacheSource(hotTicker, 'hot');
    }

    try {
      const publishedTicker = await this.cacheService.subscribeOnce<TickerDto>(
        channel,
        WAITER_TIMEOUT_MS,
      );

      if (publishedTicker) {
        return this.withCacheSource(publishedTicker, 'fresh');
      }
    } catch (error) {
      this.logger.warn(
        `Pub/sub wait failed for ${symbol}, falling back to stale cache`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    const cachedTicker = await this.cacheService.get<TickerDto>(hotCacheKey);
    if (cachedTicker) {
      this.logger.log(`Ticker hot cache filled while waiting for ${symbol}`);
      await this.backfillStaleCacheIfMissing(symbol, cachedTicker);
      return this.withCacheSource(cachedTicker, 'hot');
    }

    return this.getStaleTickerOrThrow(symbol);
  }

  private async getStaleTickerOrThrow(symbol: string): Promise<TickerDto> {
    const staleCacheKey = this.getStaleCacheKey(symbol);
    this.logger.warn(`Trying stale cache with key ${staleCacheKey}`);
    const staleTicker = await this.cacheService.get<TickerDto>(staleCacheKey);

    if (staleTicker) {
      this.logger.warn(`Ticker stale fallback served for ${symbol}`);
      return this.withCacheSource(staleTicker, 'stale');
    }

    this.logger.warn(`Stale cache miss for key ${staleCacheKey}`);
    this.logger.error(`No fresh or stale market data available for ${symbol}`);
    throw new ServiceUnavailableException(
      `Ticker data is temporarily unavailable for ${symbol}`,
    );
  }

  private async getTickerFromBinanceOrFallback(
    symbol: string,
  ): Promise<TickerDto> {
    try {
      const ticker = await this.binanceService.getTicker(symbol);
      this.logger.log(`Ticker Binance fetch success for ${symbol}`);
      return this.stripRuntimeCacheFlags(ticker);
    } catch (error) {
      if (this.isBinanceUnavailableError(error)) {
        return this.getStaleTickerOrThrow(symbol);
      }

      throw error;
    }
  }

  private async broadcastFetcherUpdate(
    symbol: string,
    ticker: TickerDto,
  ): Promise<void> {
    if (!this.marketEventsPublisher?.publishTicker) {
      return;
    }

    try {
      await this.marketEventsPublisher.publishTicker(
        `ticker:${symbol}`,
        ticker as unknown as Record<string, unknown>,
      );
    } catch (error) {
      this.logger.warn(
        `Ticker websocket broadcast failed for ${symbol}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async publishTickerUpdate(
    symbol: string,
    channel: string,
    ticker: TickerDto,
  ): Promise<void> {
    try {
      await this.cacheService.publish(channel, ticker);
    } catch (error) {
      this.logger.warn(
        `Ticker publish failed for ${symbol}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async writeTickerCaches(
    symbol: string,
    hotCacheKey: string,
    ticker: TickerDto,
  ): Promise<void> {
    const staleCacheKey = this.getStaleCacheKey(symbol);
    const cachePayload = this.stripRuntimeCacheFlags(ticker);

    await this.cacheService.set(
      hotCacheKey,
      cachePayload,
      HOT_CACHE_TTL_SECONDS,
    );
    await this.cacheService.set(
      staleCacheKey,
      cachePayload,
      STALE_CACHE_TTL_SECONDS,
    );

    this.logger.log(`Ticker stale cache written with key ${staleCacheKey}`);
  }

  private async backfillStaleCacheIfMissing(
    symbol: string,
    ticker: TickerDto,
  ): Promise<void> {
    const staleCacheKey = this.getStaleCacheKey(symbol);
    const staleTicker = await this.cacheService.get<TickerDto>(staleCacheKey);

    if (staleTicker) {
      return;
    }

    await this.cacheService.set(
      staleCacheKey,
      this.stripRuntimeCacheFlags(ticker),
      STALE_CACHE_TTL_SECONDS,
    );
    this.logger.log(`Ticker stale cache written with key ${staleCacheKey}`);
  }

  private isBinanceUnavailableError(error: unknown): boolean {
    return (
      error instanceof BinanceUnavailableException ||
      error instanceof ServiceUnavailableException
    );
  }

  private withCacheSource(
    ticker: TickerDto,
    cacheSource: 'fresh' | 'hot' | 'stale',
  ): TickerDto {
    return {
      ...this.stripRuntimeCacheFlags(ticker),
      cacheSource,
      ...(cacheSource === 'stale' ? { stale: true } : {}),
    };
  }

  private stripRuntimeCacheFlags(ticker: TickerDto): TickerDto {
    const { cacheSource: _cacheSource, stale: _stale, ...baseTicker } = ticker;
    return baseTicker;
  }

  private isStaleTicker(ticker: TickerDto): boolean {
    return ticker.cacheSource === 'stale' || ticker.stale === true;
  }

  private normalizeSymbol(symbol: string): string {
    return symbol.trim().toUpperCase();
  }

  private getHotCacheKey(symbol: string): string {
    return `app:ticker:${symbol}:hot`;
  }

  private getStaleCacheKey(symbol: string): string {
    return `app:ticker:${symbol}:stale`;
  }

  private getLockKey(symbol: string): string {
    return `app:lock:ticker:${symbol}`;
  }

  private getChannelKey(symbol: string): string {
    return `app:ch:ticker:${symbol}`;
  }
}
