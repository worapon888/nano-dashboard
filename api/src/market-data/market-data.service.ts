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
  BinanceKlineResponse,
  BinanceUnavailableException,
} from '../binance/binance.service';
import { MARKET_EVENTS_PUBLISHER } from '../events/events.tokens';
import type { MarketEventsPublisher } from '../events/events.tokens';
import { RedisService } from '../redis/redis.service';
import { BtcLivePriceUpdateDto } from './dto/btc-live-price-update.dto';
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

type BtcPriceTrendRange = 'day' | 'week' | 'month';

export type BtcPriceTrendDto = {
  range: BtcPriceTrendRange;
  currency: 'USD';
  livePrice: number;
  change24h: number;
  change24hPercent: number;
  labels: string[];
  series: number[];
  high: number;
  low: number;
  updatedAt: string;
};

export type DashboardBtcPriceTrendSnapshot = {
  range: '15m' | '1h' | '4h' | '1d';
  currency: 'USD';
  livePrice: number;
  change24h: number;
  change24hPercent: number;
  labels: string[];
  series: number[];
  high: number;
  low: number;
  updatedAt: string;
};

export type DashboardVolumeProfileSnapshot = {
  timeframe: '15m' | '1h' | '4h' | '1d';
  labels: string[];
  volume: number[];
  colors: string[];
  updatedAt: string;
};

export type DashboardMarketOverviewSnapshot = {
  btcDominance: number;
  fearGreedIndex: number;
};

export type DashboardMarketShareSnapshot = {
  symbol: string;
  dominance: number;
};

export type DashboardMarketCompositionSnapshot = {
  marketOverview: DashboardMarketOverviewSnapshot;
  marketShare: DashboardMarketShareSnapshot[];
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

const BTC_TREND_SYMBOL = 'BTCUSDT';
const BTC_PRICE_UPDATED_EVENT = 'btc.price.updated';
const VOLUME_BULLISH_COLOR = '#22c55e';
const VOLUME_BEARISH_COLOR = '#ef4444';

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
          this.getHotCacheKey(symbol),
        );
        if (hot) return this.toDashboardTickerDto(hot);

        const stale = await this.redisService.get<TickerDto>(
          this.getStaleCacheKey(symbol),
        );
        if (stale) return this.toDashboardTickerDto(stale);

        try {
          const freshTicker = await this.getTicker(symbol);
          return this.toDashboardTickerDto(freshTicker);
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

      return this.toBtcPriceTrendDto(range, ticker, klines);
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

      return this.toDashboardBtcPriceTrendDto(range, ticker, klines);
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

      return this.toDashboardVolumeProfileDto(timeframe, klines);
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
    const normalizedTickers = tickers
      .map((ticker) => {
        const price = this.toFiniteNumber(ticker.price);
        const volume24h = this.toFiniteNumber(ticker.volume24h);

        return {
          symbol: ticker.symbol,
          price,
          volume24h,
          turnover: price > 0 && volume24h > 0 ? price * volume24h : 0,
          priceChangeRatio:
            price > 0
              ? this.toFiniteNumber(ticker.priceChange24h) / price
              : 0,
        };
      })
      .filter((ticker) => ticker.symbol.length > 0);

    const totalTurnover = normalizedTickers.reduce(
      (sum, ticker) => sum + ticker.turnover,
      0,
    );
    const btcTicker = normalizedTickers.find((ticker) => ticker.symbol === 'BTCUSDT');

    if (!btcTicker || totalTurnover <= 0) {
      throw new ServiceUnavailableException(
        'Market overview is temporarily unavailable',
      );
    }

    const ethTurnover =
      normalizedTickers.find((ticker) => ticker.symbol === 'ETHUSDT')?.turnover ?? 0;
    const btcDominance = this.toPercentage((btcTicker.turnover / totalTurnover) * 100);
    const ethDominance = this.toPercentage((ethTurnover / totalTurnover) * 100);
    const othersDominance = this.toPercentage(
      Math.max(0, 100 - btcDominance - ethDominance),
    );
    const positiveBreadthRatio =
      normalizedTickers.length > 0
        ? normalizedTickers.filter((ticker) => ticker.priceChangeRatio > 0).length /
          normalizedTickers.length
        : 0.5;
    const btcMomentumPercent = btcTicker.priceChangeRatio * 100;
    const fearGreedIndex = this.clampIndex(
      Math.round(50 + btcMomentumPercent * 6 + (positiveBreadthRatio - 0.5) * 40),
    );

    return {
      marketOverview: {
        btcDominance,
        fearGreedIndex,
      },
      marketShare: [
        { symbol: 'BTC', dominance: btcDominance },
        { symbol: 'ETH', dominance: ethDominance },
        { symbol: 'OTHERS', dominance: othersDominance },
      ],
    };
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

  private toBtcPriceTrendDto(
    range: BtcPriceTrendRange,
    ticker: TickerDto,
    klines: BinanceKlineResponse[],
  ): BtcPriceTrendDto {
    const points = klines
      .map((kline) => {
        const timestamp = Number(kline[0]);
        const closePrice = Number(kline[4]);

        if (!Number.isFinite(timestamp) || !Number.isFinite(closePrice)) {
          return null;
        }

        return {
          label: this.formatTrendLabel(timestamp, range),
          closePrice,
        };
      })
      .filter(
        (
          point,
        ): point is {
          label: string;
          closePrice: number;
        } => point !== null,
      );

    const series = points.map((point) => point.closePrice);
    const labels = points.map((point) => point.label);
    const high = series.length > 0 ? Math.max(...series) : 0;
    const low = series.length > 0 ? Math.min(...series) : 0;

    return {
      range,
      currency: 'USD',
      livePrice: this.toFiniteNumber(ticker.price),
      change24h: this.toFiniteNumber(ticker.priceChange24h),
      change24hPercent: this.toFiniteNumber(ticker.priceChange24hPercent),
      labels,
      series,
      high,
      low,
      updatedAt: ticker.fetchedAt,
    };
  }

  private formatTrendLabel(
    timestamp: number,
    range: BtcPriceTrendRange,
  ): string {
    const date = new Date(timestamp);

    if (range === 'day') {
      return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'UTC',
      }).format(date);
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  }

  private toFiniteNumber(value: string | number | null | undefined): number {
    const parsed =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number(value)
          : NaN;

    return Number.isFinite(parsed) ? parsed : 0;
  }

  async getTicker(symbol: string): Promise<TickerDto> {
    const normalizedSymbol = this.normalizeSymbol(symbol);
    const hotCacheKey = this.getHotCacheKey(normalizedSymbol);
    const cachedTicker = await this.redisService.get<TickerDto>(hotCacheKey);

    if (cachedTicker) {
      this.logger.log(`Ticker hot cache hit for ${normalizedSymbol}`);
      await this.backfillStaleCacheIfMissing(normalizedSymbol, cachedTicker);
      return this.withCacheSource(cachedTicker, 'hot');
    }

    this.logger.log(`Ticker hot cache miss for ${normalizedSymbol}`);

    const lockKey = this.getLockKey(normalizedSymbol);
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
    const channel = this.getChannelKey(symbol);
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
    const channel = this.getChannelKey(symbol);

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
    const staleCacheKey = this.getStaleCacheKey(symbol);
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

      const btcLiveUpdate = this.toBtcLivePriceUpdate(symbol, ticker);
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
    const staleCacheKey = this.getStaleCacheKey(symbol);
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

    this.logger.log(`Ticker stale cache written with key ${staleCacheKey}`);
  }

  private async backfillStaleCacheIfMissing(
    symbol: string,
    ticker: TickerDto,
  ): Promise<void> {
    const staleCacheKey = this.getStaleCacheKey(symbol);
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

  private normalizeSymbol(symbol: string): string {
    return symbol.trim().toUpperCase();
  }

  private toBtcLivePriceUpdate(
    symbol: string,
    ticker: TickerDto,
  ): BtcLivePriceUpdateDto | null {
    if (symbol !== BTC_TREND_SYMBOL) {
      return null;
    }

    return {
      symbol: BTC_TREND_SYMBOL,
      price: this.toFiniteNumber(ticker.price),
      change24h: this.toFiniteNumber(ticker.priceChange24h),
      change24hPercent: this.toFiniteNumber(ticker.priceChange24hPercent),
      high24h: this.toFiniteNumber(ticker.high24h),
      low24h: this.toFiniteNumber(ticker.low24h),
      updatedAt:
        typeof ticker.fetchedAt === 'string' && ticker.fetchedAt.length > 0
          ? ticker.fetchedAt
          : new Date().toISOString(),
    };
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

  private toPercentage(value: number): number {
    return Number.isFinite(value) ? Number(value.toFixed(2)) : 0;
  }

  private clampIndex(value: number): number {
    if (!Number.isFinite(value)) {
      return 50;
    }

    return Math.max(0, Math.min(100, value));
  }

  private toDashboardBtcPriceTrendDto(
    range: DashboardBtcPriceTrendSnapshot['range'],
    ticker: {
      price: string | number | null;
      priceChange24h: string | number | null;
      priceChange24hPercent: string | number | null;
      fetchedAt: string | Date | null;
    },
    klines: BinanceKlineResponse[],
  ): DashboardBtcPriceTrendSnapshot {
    const points = klines
      .map((kline) => {
        const openTime = Number(kline[0]);
        const closePrice = Number(kline[4]);

        if (!Number.isFinite(openTime) || !Number.isFinite(closePrice)) {
          return null;
        }

        return {
          label: this.formatDashboardTrendLabel(openTime, range),
          closePrice,
        };
      })
      .filter(
        (
          point,
        ): point is {
          label: string;
          closePrice: number;
        } => point !== null,
      );

    const labels = points.map((point) => point.label);
    const series = points.map((point) => point.closePrice);

    if (labels.length === 0 || series.length === 0) {
      throw new ServiceUnavailableException(
        `BTC price trend returned no usable points for ${range}`,
      );
    }

    return {
      range,
      currency: 'USD',
      livePrice: this.toFiniteNumber(ticker.price),
      change24h: this.toFiniteNumber(ticker.priceChange24h),
      change24hPercent: this.toFiniteNumber(ticker.priceChange24hPercent),
      labels,
      series,
      high: Math.max(...series),
      low: Math.min(...series),
      updatedAt:
        typeof ticker.fetchedAt === 'string'
          ? ticker.fetchedAt
          : new Date().toISOString(),
    };
  }

  private toDashboardVolumeProfileDto(
    timeframe: DashboardVolumeProfileSnapshot['timeframe'],
    klines: BinanceKlineResponse[],
  ): DashboardVolumeProfileSnapshot {
    const points = klines
      .map((kline) => {
        const openTime = Number(kline[0]);
        const open = Number(kline[1]);
        const close = Number(kline[4]);
        const volume = Number(kline[5]);

        if (
          !Number.isFinite(openTime) ||
          !Number.isFinite(open) ||
          !Number.isFinite(close) ||
          !Number.isFinite(volume)
        ) {
          return null;
        }

        return {
          label: this.formatDashboardVolumeLabel(openTime, timeframe),
          volume,
          color: close >= open ? VOLUME_BULLISH_COLOR : VOLUME_BEARISH_COLOR,
          updatedAt: new Date(Number(kline[6])).toISOString(),
        };
      })
      .filter(
        (
          point,
        ): point is {
          label: string;
          volume: number;
          color: string;
          updatedAt: string;
        } => point !== null,
      );

    return {
      timeframe,
      labels: points.map((point) => point.label),
      volume: points.map((point) => point.volume),
      colors: points.map((point) => point.color),
      updatedAt:
        points.length > 0
          ? points[points.length - 1].updatedAt
          : new Date().toISOString(),
    };
  }

  private formatDashboardTrendLabel(
    timestamp: number,
    range: DashboardBtcPriceTrendSnapshot['range'],
  ): string {
    const date = new Date(timestamp);

    if (range === '15m' || range === '1h') {
      return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'UTC',
      }).format(date);
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  }

  private formatDashboardVolumeLabel(
    timestamp: number,
    timeframe: DashboardVolumeProfileSnapshot['timeframe'],
  ): string {
    const date = new Date(timestamp);

    if (timeframe === '15m' || timeframe === '1h') {
      return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'UTC',
      }).format(date);
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  }
}
