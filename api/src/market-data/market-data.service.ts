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
import { TickerDto } from './dto/ticker.dto';

const HOT_CACHE_TTL_SECONDS = 10;
const STALE_CACHE_TTL_SECONDS = 120;
const LOCK_TTL_SECONDS = 5;
const WAITER_TIMEOUT_MS = 6000;

type TickerBroadcastGateway = {
  broadcastTicker?(room: string, ticker: TickerDto): Promise<void> | void;
};

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);

  constructor(
    private readonly binanceService: BinanceService,
    private readonly cacheService: CacheService,
    @Optional()
    @Inject('MARKET_TICKER_GATEWAY')
    private readonly tickerGateway?: TickerBroadcastGateway,
  ) {}

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
    return this.waitForFetcherOrFallback(normalizedSymbol);
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

  private async waitForFetcherOrFallback(symbol: string): Promise<TickerDto> {
    const channel = this.getChannelKey(symbol);

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
    if (!this.tickerGateway?.broadcastTicker) {
      return;
    }

    try {
      await this.tickerGateway.broadcastTicker(`ticker:${symbol}`, ticker);
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
    return `app:ticker:${symbol}`;
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
