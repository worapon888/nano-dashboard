import {
  Inject,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  BinanceService,
  BinanceKlineInterval,
  BinanceUnavailableException,
} from '../binance/binance.service';
import { MARKET_EVENTS_PUBLISHER } from '../events/events.tokens';
import type { MarketEventsPublisher } from '../events/events.tokens';
import { RedisService } from '../redis/redis.service';
import { TickerDto } from './dto/ticker.dto';
import {
  BtcPriceTrendDto,
  BtcPriceTrendRange,
  DashboardBtcPriceTrendSnapshot,
  DashboardMarketCompositionSnapshot,
  DashboardTickerDto,
  DashboardVolumeProfileSnapshot,
  buildDashboardMarketComposition,
  getChannelKey,
  getHotCacheKey,
  getLockKey,
  getStaleCacheKey,
  normalizeSymbol,
  toBtcLivePriceUpdate,
  toBtcPriceTrendDto,
  toDashboardBtcPriceTrendDto,
  toDashboardTickerDto,
  toDashboardVolumeProfileDto,
  toFiniteNumber,
} from './market-data.helpers';

const HOT_CACHE_TTL_SECONDS = 10;
const STALE_CACHE_TTL_SECONDS = 120;
const LOCK_TTL_SECONDS = 5;
const WAITER_TIMEOUT_MS = 6000;

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

const BTC_TREND_SYMBOL = 'BTCUSDT';
const BTC_PRICE_UPDATED_EVENT = 'btc.price.updated';

const BTC_TREND_CONFIG: Record<
  BtcPriceTrendRange,
  { interval: BinanceKlineInterval; limit: number }
> = {
  day: { interval: '1h', limit: 24 },
  week: { interval: '4h', limit: 42 },
  month: { interval: '1d', limit: 30 },
};

const DASHBOARD_BTC_TREND_CONFIG: Record<
  DashboardBtcPriceTrendSnapshot['range'],
  { interval: BinanceKlineInterval; limit: number }
> = {
  '15m': { interval: '15m', limit: 24 },
  '1h': { interval: '1h', limit: 24 },
  '4h': { interval: '4h', limit: 21 },
  '1d': { interval: '1d', limit: 21 },
};

const DASHBOARD_VOLUME_PROFILE_CONFIG: Record<
  DashboardVolumeProfileSnapshot['timeframe'],
  { interval: BinanceKlineInterval; limit: number }
> = {
  '15m': { interval: '15m', limit: 28 },
  '1h': { interval: '1h', limit: 28 },
  '4h': { interval: '4h', limit: 18 },
  '1d': { interval: '1d', limit: 16 },
};

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);

  constructor(
    private readonly binanceService: BinanceService,
    private readonly redisService: RedisService,
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
        const hot = await this.redisService.get<TickerDto>(
          getHotCacheKey(symbol),
        );
        if (hot) return toDashboardTickerDto(hot);

        const stale = await this.redisService.get<TickerDto>(
          getStaleCacheKey(symbol),
        );
        if (stale) return toDashboardTickerDto(stale);

        try {
          const freshTicker = await this.getTicker(symbol);
          return toDashboardTickerDto(freshTicker);
        } catch (error) {
          this.logger.warn(
            `Tracked ticker unavailable for ${symbol}: ${
              error instanceof Error ? error.message : 'unknown error'
            }`,
          );
          return null;
        }
      }),
    );

    return results
      .filter(
        (r): r is PromiseFulfilledResult<DashboardTickerDto> =>
          r.status === 'fulfilled' && r.value !== null,
      )
      .map((r) => r.value);
  }

  async getBtcPriceTrend(range: BtcPriceTrendRange): Promise<BtcPriceTrendDto> {
    const config = BTC_TREND_CONFIG[range];

    if (!config) {
      throw new ServiceUnavailableException(
        `Unsupported BTC price trend range: ${range}`,
      );
    }

    try {
      const [ticker, klines] = await Promise.all([
        this.getTicker(BTC_TREND_SYMBOL),
        this.binanceService.getKlines(
          BTC_TREND_SYMBOL,
          config.interval,
          config.limit,
        ),
      ]);

      return toBtcPriceTrendDto(range, ticker, klines);
    } catch (error) {
      if (this.isBinanceUnavailableError(error)) {
        this.logger.warn(
          `BTC price trend unavailable for ${range}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
        throw new ServiceUnavailableException(
          `BTC price trend is temporarily unavailable for ${range}`,
        );
      }

      throw error;
    }
  }

  async getDashboardBtcPriceTrend(
    range: DashboardBtcPriceTrendSnapshot['range'],
  ): Promise<DashboardBtcPriceTrendSnapshot> {
    const config = DASHBOARD_BTC_TREND_CONFIG[range];

    if (!config) {
      throw new ServiceUnavailableException(
        `Unsupported BTC price trend range: ${range}`,
      );
    }

    try {
      const [ticker, klines] = await Promise.all([
        this.binanceService.getTicker(BTC_TREND_SYMBOL),
        this.binanceService.getKlines(
          BTC_TREND_SYMBOL,
          config.interval,
          config.limit,
        ),
      ]);

      return toDashboardBtcPriceTrendDto(range, ticker, klines);
    } catch (error) {
      if (this.isBinanceUnavailableError(error)) {
        this.logger.warn(
          `Dashboard BTC price trend unavailable for ${range}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
        throw new ServiceUnavailableException(
          `BTC price trend is temporarily unavailable for ${range}`,
        );
      }

      throw error;
    }
  }

  async getDashboardVolumeProfile(
    timeframe: DashboardVolumeProfileSnapshot['timeframe'],
  ): Promise<DashboardVolumeProfileSnapshot> {
    const config = DASHBOARD_VOLUME_PROFILE_CONFIG[timeframe];

    if (!config) {
      throw new ServiceUnavailableException(
        `Unsupported volume profile timeframe: ${timeframe}`,
      );
    }

    try {
      const klines = await this.binanceService.getKlines(
        BTC_TREND_SYMBOL,
        config.interval,
        config.limit,
      );

      return toDashboardVolumeProfileDto(timeframe, klines);
    } catch (error) {
      if (this.isBinanceUnavailableError(error)) {
        this.logger.warn(
          `Dashboard volume profile unavailable for ${timeframe}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
        throw new ServiceUnavailableException(
          `Volume profile is temporarily unavailable for ${timeframe}`,
        );
      }

      throw error;
    }
  }

  buildDashboardMarketComposition(
    tickers: DashboardTickerDto[],
  ): DashboardMarketCompositionSnapshot {
    return buildDashboardMarketComposition(tickers);
  }

  async getTicker(symbol: string): Promise<TickerDto> {
    const normalizedSymbol = normalizeSymbol(symbol);
    const redisClient = this.redisService.getClient();
    const redisReady = this.redisService.isReady();

    if (!redisClient || !redisReady) {
      this.logger.warn(
        `Redis unavailable; fetching ticker directly for ${normalizedSymbol}`,
      );
      const directTicker =
        await this.getTickerFromBinanceOrFallbackWithoutRedis(normalizedSymbol);

      return this.isStaleTicker(directTicker)
        ? directTicker
        : this.withCacheSource(directTicker, 'fresh');
    }

    const hotCacheKey = getHotCacheKey(normalizedSymbol);
    const cachedTicker = await this.redisService.get<TickerDto>(hotCacheKey);

    if (cachedTicker) {
      this.logger.log(`Ticker hot cache hit for ${normalizedSymbol}`);
      await this.backfillStaleCacheIfMissing(normalizedSymbol, cachedTicker);
      return this.withCacheSource(cachedTicker, 'hot');
    }

    this.logger.log(`Ticker hot cache miss for ${normalizedSymbol}`);

    const lockKey = getLockKey(normalizedSymbol);
    const lockValue = `${process.pid}:${Date.now()}`;
    const lockAcquired = await this.redisService.setNx(
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
    const channel = getChannelKey(symbol);
    const ticker = await this.getTickerFromBinanceOrFallback(symbol);

    if (this.isStaleTicker(ticker)) {
      await this.redisService.del(lockKey);
      return ticker;
    }

    try {
      await this.writeTickerCaches(symbol, hotCacheKey, ticker);
    } finally {
      await this.redisService.del(lockKey);
    }

    await this.publishTickerUpdate(symbol, channel, ticker);
    await this.broadcastFetcherUpdate(symbol, ticker);

    return this.withCacheSource(ticker, 'fresh');
  }

  private async waitForFetcherOrFallback(
    symbol: string,
    hotCacheKey: string,
  ): Promise<TickerDto> {
    const channel = getChannelKey(symbol);

    const hotTicker = await this.redisService.get<TickerDto>(hotCacheKey);
    if (hotTicker) {
      this.logger.log(`Ticker hot cache won race for ${symbol}`);
      await this.backfillStaleCacheIfMissing(symbol, hotTicker);
      return this.withCacheSource(hotTicker, 'hot');
    }

    try {
      const publishedTicker = await this.redisService.subscribeOnce<TickerDto>(
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

    const cachedTicker = await this.redisService.get<TickerDto>(hotCacheKey);
    if (cachedTicker) {
      this.logger.log(`Ticker hot cache filled while waiting for ${symbol}`);
      await this.backfillStaleCacheIfMissing(symbol, cachedTicker);
      return this.withCacheSource(cachedTicker, 'hot');
    }

    return this.getStaleTickerOrThrow(symbol);
  }

  private async getStaleTickerOrThrow(symbol: string): Promise<TickerDto> {
    const staleCacheKey = getStaleCacheKey(symbol);
    this.logger.warn(`Trying stale cache with key ${staleCacheKey}`);
    const staleTicker = await this.redisService.get<TickerDto>(staleCacheKey);

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

      if (this.isUnavailableTicker(ticker)) {
        throw new BinanceUnavailableException(
          `Fallback ticker payload returned for ${symbol}`,
        );
      }

      this.logger.log(`Ticker Binance fetch success for ${symbol}`);
      return this.stripRuntimeCacheFlags(ticker);
    } catch (error) {
      if (this.isBinanceUnavailableError(error)) {
        return this.getStaleTickerOrThrow(symbol);
      }

      throw error;
    }
  }

  private async getTickerFromBinanceOrFallbackWithoutRedis(
    symbol: string,
  ): Promise<TickerDto> {
    try {
      const ticker = await this.binanceService.getTicker(symbol);

      if (this.isUnavailableTicker(ticker)) {
        throw new BinanceUnavailableException(
          `Fallback ticker payload returned for ${symbol}`,
        );
      }

      this.logger.log(`Ticker direct Binance fetch success for ${symbol}`);
      return this.stripRuntimeCacheFlags(ticker);
    } catch (error) {
      if (this.isBinanceUnavailableError(error)) {
        this.logger.warn(
          `Ticker direct fetch unavailable for ${symbol} and Redis is disabled`,
        );
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

      const btcLiveUpdate = toBtcLivePriceUpdate(
        symbol,
        BTC_TREND_SYMBOL,
        ticker,
      );
      if (btcLiveUpdate) {
        await this.marketEventsPublisher.publishTicker(
          BTC_PRICE_UPDATED_EVENT,
          btcLiveUpdate as unknown as Record<string, unknown>,
        );
      }
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
      await this.redisService.publish(channel, ticker);
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
    const staleCacheKey = getStaleCacheKey(symbol);
    const cachePayload = this.stripRuntimeCacheFlags(ticker);

    await this.redisService.set(
      hotCacheKey,
      cachePayload,
      HOT_CACHE_TTL_SECONDS,
    );
    await this.redisService.set(
  staleCacheKey,
  cachePayload,
  STALE_CACHE_TTL_SECONDS,
);

  this.logger.log(
  `Ticker caches written: hot=${hotCacheKey}, stale=${staleCacheKey}`,
);
  }

  private async backfillStaleCacheIfMissing(
    symbol: string,
    ticker: TickerDto,
  ): Promise<void> {
    const staleCacheKey = getStaleCacheKey(symbol);
    const staleTicker = await this.redisService.get<TickerDto>(staleCacheKey);

    if (staleTicker) {
      return;
    }

    await this.redisService.set(
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

  private isUnavailableTicker(ticker: TickerDto): boolean {
    if (ticker.stale === true || ticker.source === 'fallback') {
      return true;
    }

    const price = toFiniteNumber(ticker.price);
    const volume24h = toFiniteNumber(ticker.volume24h);

    return price <= 0 || volume24h <= 0;
  }

}
