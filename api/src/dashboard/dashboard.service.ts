import {
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BinanceService } from '../binance/binance.service';
import {
  MarketDataService,
} from '../market-data/market-data.service';
import { OrdersService } from '../orders/orders.service';
import { PnlService } from '../pnl/pnl.service';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import {
  DashboardBtcPriceTrendDto,
  DashboardDailyPnlDto,
  DashboardHealthDto,
  DashboardMarketOverviewDto,
  DashboardSummaryDto,
  DashboardTopMoverDto,
  DashboardVolumeProfileDto,
  DashboardOpenOrdersDto,
  MarketShareItemDto,
} from './dto/dashboard-summary.dto';
import { InternalService } from '../internal/internal.service';
import {
  getDashboardSummaryHotCacheKey,
  getDashboardSummaryStaleCacheKey,
} from './dashboard-cache.util';

type TopMoverPayload = {
  symbol?: string | null;
  price?: string | number | null;
  volume24h?: string | number | null;
  priceChange24h?: string | number | null;
  high24h?: string | number | null;
  low24h?: string | number | null;
  fetchedAt?: string | Date | null;
};

type QuickHealthPayload = {
  db?: 'up' | 'down' | 'unknown' | null;
  redis?: 'up' | 'down' | 'unknown' | null;
  wsConnections?: number | null;
};

type MarketSharePayload = {
  symbol?: string | null;
  dominance?: number | string | null;
};

type BtcPriceTrendPayload = {
  range?: '15m' | '1h' | '4h' | '1d' | null;
  currency?: 'USD' | null;
  livePrice?: number | string | null;
  change24h?: number | string | null;
  change24hPercent?: number | string | null;
  labels?: unknown;
  series?: unknown;
  high?: number | string | null;
  low?: number | string | null;
  updatedAt?: string | Date | null;
};

type BtcTrendRange = DashboardBtcPriceTrendDto['range'];
type DailyPnlRange = DashboardDailyPnlDto['range'];
type DailyPnlPayload = {
  range?: DailyPnlRange | null;
  weeklyNet?: number | string | null;
  series?: unknown;
  stats?: {
    best?: number | string | null;
    worst?: number | string | null;
    avg?: number | string | null;
    win?: number | string | null;
    loss?: number | string | null;
  } | null;
  updatedAt?: string | Date | null;
};
type DailyPnlPointPayload = {
  day?: string | null;
  value?: number | string | null;
};
type OpenOrdersPayload = {
  activeCount?: number | string | null;
  totalCount?: number | string | null;
  items?: unknown;
  updatedAt?: string | Date | null;
};
type OpenOrderPayload = {
  id?: string | null;
  pair?: string | null;
  side?: 'BUY' | 'SELL' | null;
  type?: 'Limit' | 'Market' | 'Stop' | 'TP' | null;
  price?: number | string | null;
  amount?: number | string | null;
  filledPercent?: number | string | null;
  totalUsd?: number | string | null;
  status?: 'Open' | 'Partial' | 'Filled' | 'Cancelled' | null;
  createdAtLabel?: string | null;
};
type VolumeProfilePayload = {
  timeframe?: '15m' | '1h' | '4h' | '1d' | null;
  labels?: unknown;
  volume?: unknown;
  colors?: unknown;
  updatedAt?: string | Date | null;
};
type VolumeTimeframe = DashboardVolumeProfileDto['timeframe'];

const TOP_MOVERS_LIMIT = 5;
const DASHBOARD_HOT_CACHE_TTL_SECONDS = 30;
const DASHBOARD_STALE_CACHE_TTL_SECONDS = 300;
const DASHBOARD_SECTION_TIMEOUT_MS = 7000;

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly binanceService: BinanceService,
    private readonly marketDataService: MarketDataService,
    private readonly ordersService: OrdersService,
    private readonly pnlService: PnlService,
    private readonly redisService: RedisService,
    @Optional()
    private readonly internalService?: InternalService,
  ) {}

  async getAggregatedDashboard(): Promise<{
    users: {
      total: number;
      active: number;
      list: Awaited<ReturnType<UsersService['getDashboardUsersSnapshot']>>['list'];
    };
    market: {
      BTCUSDT: { price: string; cachedAt: string };
      ETHUSDT: { price: string; cachedAt: string };
    };
  }> {
    const [users, btcPrice, ethPrice] = await Promise.all([
      this.usersService.getDashboardUsersSnapshot(),
      this.binanceService.getPrice('BTCUSDT'),
      this.binanceService.getPrice('ETHUSDT'),
    ]);

    return {
      users,
      market: {
        BTCUSDT: {
          price: btcPrice.price,
          cachedAt: btcPrice.fetchedAt,
        },
        ETHUSDT: {
          price: ethPrice.price,
          cachedAt: ethPrice.fetchedAt,
        },
      },
    };
  }

  async getSummary(
    userId: string,
    rangeInput?: string,
    volumeTfInput?: string,
    pnlRangeInput?: string,
  ): Promise<DashboardSummaryDto> {
    const range = this.normalizeTrendRange(rangeInput);
    const volumeTf = this.normalizeVolumeTimeframe(volumeTfInput);
    const pnlRange = this.normalizeDailyPnlRange(pnlRangeInput);
    const hotCacheKey = this.getHotCacheKey(userId, range, volumeTf, pnlRange);
    const staleCacheKey = this.getStaleCacheKey(
      userId,
      range,
      volumeTf,
      pnlRange,
    );

    try {
      const hotCachePayload =
        await this.redisService.get<DashboardSummaryDto>(hotCacheKey);
      const hotCache = this.parseSummaryCache(hotCachePayload);

      if (hotCache) {
        this.logger.log(`[Dashboard] cache hit: ${hotCacheKey}`);
        return hotCache;
      }
    } catch (error) {
      this.logger.warn(
        `[Dashboard] hot cache read failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }

    this.logger.log(`[Dashboard] cache miss: ${hotCacheKey}`);

    let staleSummary: DashboardSummaryDto | null = null;

    try {
      const staleSummaryPayload = await this.redisService.get<DashboardSummaryDto>(
        staleCacheKey,
      );
      staleSummary = this.parseSummaryCache(staleSummaryPayload);
    } catch (error) {
      this.logger.warn(
        `Dashboard stale cache read failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }

    try {
      const summary = await this.buildSummary(userId, range, volumeTf, pnlRange);

      await this.writeSummaryCaches(userId, range, volumeTf, pnlRange, summary);

      this.logger.log('[Dashboard] summary built successfully');
      return summary;
    } catch (error) {
      this.logger.error(
        `[Dashboard] summary build failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (staleSummary) {
        this.logger.warn('Dashboard stale fallback hit');
        return {
          ...staleSummary,
          stale: true,
        };
      }

      throw new ServiceUnavailableException(
        'Dashboard summary is temporarily unavailable',
      );
    }
  }

  private async buildSummary(
    userId: string,
    range: BtcTrendRange,
    volumeTf: VolumeTimeframe,
    pnlRange: DailyPnlRange,
  ): Promise<DashboardSummaryDto> {
    if (process.env.FORCE_DASHBOARD_BUILD_FAIL === 'true') {
      this.logger.warn('Dashboard build forced to fail for testing');
      throw new Error('Dashboard build forced to fail for testing');
    }

    if (
      !this.marketDataService?.getTrackedTickers ||
      !this.marketDataService?.buildDashboardMarketComposition
    ) {
      throw new ServiceUnavailableException(
        'Dashboard market data services are temporarily unavailable',
      );
    }

    const warnings: string[] = [];
    const healthPromise = this.internalService?.getQuickHealth
      ? this.internalService.getQuickHealth()
      : Promise.resolve({
          db: 'up' as const,
          redis: 'up' as const,
          wsConnections: 0,
        });

    const [
      userCountResult,
      topMoversResult,
      healthResult,
      btcPriceTrendResult,
      volumeProfileResult,
      dailyPnlResult,
      openOrdersResult,
    ] =
      await Promise.allSettled([
        this.withSectionTimeout(
          this.usersService.getActiveCount(),
          'UsersService.getActiveCount',
        ),
        this.withSectionTimeout(
          this.marketDataService.getTrackedTickers(TOP_MOVERS_LIMIT),
          'MarketDataService.getTrackedTickers',
        ),
        this.withSectionTimeout(healthPromise, 'InternalService.getQuickHealth'),
        this.withSectionTimeout(
          this.marketDataService.getDashboardBtcPriceTrend(range),
          'MarketDataService.getDashboardBtcPriceTrend',
        ),
        this.withSectionTimeout(
          this.marketDataService.getDashboardVolumeProfile(volumeTf),
          'MarketDataService.getDashboardVolumeProfile',
        ),
        this.withSectionTimeout(
          this.pnlService.getWeeklyPnl(userId, pnlRange),
          'PnlService.getWeeklyPnl',
        ),
        this.withSectionTimeout(
          this.ordersService.getOpenOrders(userId),
          'OrdersService.getOpenOrders',
        ),
      ]);

    const userCount =
      userCountResult.status === 'fulfilled' ? userCountResult.value : null;

    if (userCountResult.status === 'rejected') {
      warnings.push('user_count_unavailable');
      this.logWarning('UsersService.getActiveCount', userCountResult.reason);
    }

    const topMovers =
      topMoversResult.status === 'fulfilled'
        ? this.mapTopMovers(topMoversResult.value)
        : [];

    if (topMoversResult.status === 'rejected') {
      warnings.push('market_data_unavailable');
      this.logWarning(
        'MarketDataService.getTrackedTickers',
        topMoversResult.reason,
      );
    }

    const marketComposition =
      topMoversResult.status === 'fulfilled'
        ? this.buildMarketCompositionSafely(
            topMoversResult.value,
            warnings,
          )
        : this.createFallbackMarketComposition();

    const health =
      healthResult.status === 'fulfilled'
        ? this.mapHealth(healthResult.value)
        : this.getFallbackHealth();

    if (healthResult.status === 'rejected') {
      warnings.push('internal_health_unavailable');
      this.logWarning('InternalService.getQuickHealth', healthResult.reason);
    }

    const btcPriceTrend =
      btcPriceTrendResult.status === 'fulfilled'
        ? btcPriceTrendResult.value
        : this.createFallbackBtcPriceTrend(range);

    if (btcPriceTrendResult.status === 'rejected') {
      warnings.push('btc_price_trend_unavailable');
      this.logWarning(
        'MarketDataService.getDashboardBtcPriceTrend',
        btcPriceTrendResult.reason,
      );
    }

    const volumeProfile =
      volumeProfileResult.status === 'fulfilled'
        ? volumeProfileResult.value
        : this.createFallbackVolumeProfile(volumeTf);

    if (volumeProfileResult.status === 'rejected') {
      warnings.push('volume_profile_unavailable');
      this.logWarning(
        'MarketDataService.getDashboardVolumeProfile',
        volumeProfileResult.reason,
      );
    }

    const dailyPnl =
      dailyPnlResult.status === 'fulfilled'
        ? this.mapDailyPnl(dailyPnlResult.value)
        : this.createFallbackDailyPnl(pnlRange);

    if (dailyPnlResult.status === 'rejected') {
      warnings.push('daily_pnl_unavailable');
      this.logWarning('PnlService.getWeeklyPnl', dailyPnlResult.reason);
    }

    const openOrders =
      openOrdersResult.status === 'fulfilled'
        ? this.mapOpenOrders(openOrdersResult.value)
        : this.createFallbackOpenOrders();

    if (openOrdersResult.status === 'rejected') {
      warnings.push('open_orders_unavailable');
      this.logWarning('OrdersService.getOpenOrders', openOrdersResult.reason);
    }

    const { marketOverview, marketShare } = marketComposition;

    return {
      userCount,
      topMovers,
      marketOverview,
      marketShare,
      btcPriceTrend,
      volumeProfile,
      dailyPnl,
      openOrders,
      health,
      warnings: this.normalizeWarnings(warnings),
      generatedAt: new Date().toISOString(),
    };
  }

  private async writeSummaryCaches(
    userId: string,
    range: BtcTrendRange,
    volumeTf: VolumeTimeframe,
    pnlRange: DailyPnlRange,
    summary: DashboardSummaryDto,
  ): Promise<void> {
    const hotCacheKey = this.getHotCacheKey(userId, range, volumeTf, pnlRange);
    const staleCacheKey = this.getStaleCacheKey(
      userId,
      range,
      volumeTf,
      pnlRange,
    );

    try {
      await Promise.all([
        this.redisService.set(
          hotCacheKey,
          summary,
          DASHBOARD_HOT_CACHE_TTL_SECONDS,
        ),
        this.redisService.set(
          staleCacheKey,
          summary,
          DASHBOARD_STALE_CACHE_TTL_SECONDS,
        ),
      ]);
    } catch (error) {
      this.logger.warn(
        `Dashboard cache write failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private normalizeTrendRange(rangeInput?: string | null): BtcTrendRange {
    return rangeInput === '15m' ||
      rangeInput === '1h' ||
      rangeInput === '4h' ||
      rangeInput === '1d'
      ? rangeInput
      : '1h';
  }

  private normalizeVolumeTimeframe(
    timeframeInput?: string | null,
  ): VolumeTimeframe {
    return timeframeInput === '15m' ||
      timeframeInput === '1h' ||
      timeframeInput === '4h' ||
      timeframeInput === '1d'
      ? timeframeInput
      : '1h';
  }

  private normalizeDailyPnlRange(rangeInput?: string | null): DailyPnlRange {
    return rangeInput === 'week' ||
      rangeInput === 'month' ||
      rangeInput === 'year'
      ? rangeInput
      : 'week';
  }

  private getHotCacheKey(
    userId: string,
    range: BtcTrendRange,
    volumeTf: VolumeTimeframe,
    pnlRange: DailyPnlRange,
  ): string {
    return getDashboardSummaryHotCacheKey(userId, range, volumeTf, pnlRange);
  }

  private getStaleCacheKey(
    userId: string,
    range: BtcTrendRange,
    volumeTf: VolumeTimeframe,
    pnlRange: DailyPnlRange,
  ): string {
    return getDashboardSummaryStaleCacheKey(
      userId,
      range,
      volumeTf,
      pnlRange,
    );
  }

  private parseSummaryCache(payload: unknown): DashboardSummaryDto | null {
    try {
      const parsed =
        typeof payload === 'string'
          ? (JSON.parse(payload) as Partial<DashboardSummaryDto>)
          : ((payload ?? {}) as Partial<DashboardSummaryDto>);

      const hasBtcPriceTrend =
        parsed.btcPriceTrend !== undefined && parsed.btcPriceTrend !== null;
      const hasVolumeProfile =
        parsed.volumeProfile !== undefined && parsed.volumeProfile !== null;
      const hasDailyPnl = parsed.dailyPnl !== undefined && parsed.dailyPnl !== null;
      const hasOpenOrders =
        parsed.openOrders !== undefined && parsed.openOrders !== null;

      if (!hasBtcPriceTrend || !hasVolumeProfile || !hasDailyPnl || !hasOpenOrders) {
        this.logger.warn(
          'Dashboard cache entry missing btcPriceTrend, volumeProfile, dailyPnl, or openOrders; forcing rebuild',
        );
        return null;
      }

      return {
        userCount:
          typeof parsed.userCount === 'number' ? parsed.userCount : null,
        topMovers: this.mapTopMovers(parsed.topMovers),
        marketOverview: this.requireMarketOverview(parsed.marketOverview),
        marketShare: this.mapMarketShare(
          parsed.marketShare,
          this.requireMarketOverview(parsed.marketOverview),
        ),
        btcPriceTrend: this.mapBtcPriceTrend(parsed.btcPriceTrend),
        volumeProfile: this.mapVolumeProfile(parsed.volumeProfile),
        dailyPnl: this.mapDailyPnl(parsed.dailyPnl),
        openOrders: this.mapOpenOrders(parsed.openOrders),
        health: this.mapHealth(parsed.health),
        warnings: this.normalizeWarnings(parsed.warnings),
        ...(parsed.stale === true ? { stale: true } : {}),
        generatedAt: this.toIsoString(parsed.generatedAt),
      };
    } catch (error) {
      this.logger.warn(
        `Dashboard cache parse failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return null;
    }
  }

  private mapTopMovers(payload: unknown): DashboardTopMoverDto[] {
    if (!Array.isArray(payload)) {
      return [];
    }

    return payload.slice(0, TOP_MOVERS_LIMIT).map((item) => {
      const mover = item as TopMoverPayload;

      return {
        symbol: mover.symbol ? String(mover.symbol) : '',
        price: this.toRequiredString(mover.price),
        volume24h: this.toOptionalString(mover.volume24h),
        priceChange24h: this.toOptionalString(mover.priceChange24h),
        high24h: this.toOptionalString(mover.high24h),
        low24h: this.toOptionalString(mover.low24h),
        fetchedAt: this.toIsoString(mover.fetchedAt),
      };
    });
  }

  private mapHealth(payload: unknown): DashboardHealthDto {
    const health = (payload ?? {}) as QuickHealthPayload;

    return {
      db: this.toHealthStatus(health.db),
      redis: this.toHealthStatus(health.redis),
      wsConnections:
        typeof health.wsConnections === 'number' ? health.wsConnections : 0,
    };
  }

  private requireMarketOverview(payload: unknown): DashboardMarketOverviewDto {
    const overview = (payload ?? {}) as Partial<DashboardMarketOverviewDto>;

    if (
      typeof overview.btcDominance !== 'number' ||
      !Number.isFinite(overview.btcDominance) ||
      typeof overview.fearGreedIndex !== 'number' ||
      !Number.isFinite(overview.fearGreedIndex)
    ) {
      throw new Error('Dashboard cache entry missing a valid marketOverview');
    }

    return {
      btcDominance: overview.btcDominance,
      fearGreedIndex: overview.fearGreedIndex,
    };
  }

  private mapMarketShare(
    payload: unknown,
    marketOverview: DashboardMarketOverviewDto,
  ): MarketShareItemDto[] {
    if (!Array.isArray(payload)) {
      throw new Error('Dashboard cache entry missing a valid marketShare');
    }

    const items = payload
      .map((item) => {
        const marketShareItem = item as MarketSharePayload;
        const dominance =
          typeof marketShareItem.dominance === 'number'
            ? marketShareItem.dominance
            : typeof marketShareItem.dominance === 'string'
              ? Number(marketShareItem.dominance)
              : NaN;

        return {
          symbol: marketShareItem.symbol ? String(marketShareItem.symbol) : '',
          dominance,
        };
      })
      .filter(
        (item): item is MarketShareItemDto =>
          item.symbol.length > 0 && Number.isFinite(item.dominance),
      );

    if (items.length === 0) {
      throw new Error('Dashboard cache entry missing a valid marketShare');
    }

    return items;
  }

  private mapBtcPriceTrend(payload: unknown): DashboardBtcPriceTrendDto {
    const trend = (payload ?? {}) as BtcPriceTrendPayload;
    const labels = Array.isArray(trend.labels)
      ? trend.labels.filter((label): label is string => typeof label === 'string')
      : [];
    const series = Array.isArray(trend.series)
      ? trend.series
          .map((value) =>
            typeof value === 'number'
              ? value
              : typeof value === 'string'
                ? Number(value)
                : NaN,
          )
          .filter((value): value is number => Number.isFinite(value))
      : [];
    const pointCount = Math.min(labels.length, series.length);

    return {
      range:
        trend.range === '15m' ||
        trend.range === '1h' ||
        trend.range === '4h' ||
        trend.range === '1d'
          ? trend.range
          : '1h',
      currency: trend.currency === 'USD' ? 'USD' : 'USD',
      livePrice: this.toFiniteNumber(trend.livePrice),
      change24h: this.toFiniteNumber(trend.change24h),
      change24hPercent: this.toFiniteNumber(trend.change24hPercent),
      labels: labels.slice(0, pointCount),
      series: series.slice(0, pointCount),
      high: this.toFiniteNumber(trend.high),
      low: this.toFiniteNumber(trend.low),
      updatedAt: this.toIsoString(trend.updatedAt),
    };
  }

  private mapVolumeProfile(payload: unknown): DashboardVolumeProfileDto {
    const profile = (payload ?? {}) as VolumeProfilePayload;
    const labels = Array.isArray(profile.labels)
      ? profile.labels.filter((label): label is string => typeof label === 'string')
      : [];
    const volume = Array.isArray(profile.volume)
      ? profile.volume
          .map((value) =>
            typeof value === 'number'
              ? value
              : typeof value === 'string'
                ? Number(value)
                : NaN,
          )
          .filter((value): value is number => Number.isFinite(value))
      : [];
    const colors = Array.isArray(profile.colors)
      ? profile.colors.filter((color): color is string => typeof color === 'string')
      : [];
    const pointCount = Math.min(labels.length, volume.length, colors.length);

    return {
      timeframe:
        profile.timeframe === '15m' ||
        profile.timeframe === '1h' ||
        profile.timeframe === '4h' ||
        profile.timeframe === '1d'
          ? profile.timeframe
          : '1h',
      labels: labels.slice(0, pointCount),
      volume: volume.slice(0, pointCount),
      colors: colors.slice(0, pointCount),
      updatedAt: this.toIsoString(profile.updatedAt),
    };
  }

  private mapDailyPnl(payload: unknown): DashboardDailyPnlDto {
    const dailyPnl = (payload ?? {}) as DailyPnlPayload;
    const series = Array.isArray(dailyPnl.series)
      ? dailyPnl.series
          .map((item) => {
            const point = item as DailyPnlPointPayload;
            const value =
              typeof point.value === 'number'
                ? point.value
                : typeof point.value === 'string'
                  ? Number(point.value)
                  : NaN;

            return {
              day: this.normalizePnlDay(point.day),
              value,
            };
          })
          .filter(
            (
              item,
            ): item is {
              day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
              value: number;
            } => item.day !== null && Number.isFinite(item.value),
          )
      : [];

    const normalizedRange =
      dailyPnl.range === 'month' || dailyPnl.range === 'year'
        ? dailyPnl.range
        : 'week';
    const normalizedSeries =
      series.length > 0
        ? this.normalizeDailyPnlSeries(series, normalizedRange)
        : [];
    const stats = dailyPnl.stats ?? {};

    return {
      range: normalizedRange,
      weeklyNet: this.toFiniteNumber(dailyPnl.weeklyNet),
      series: normalizedSeries,
      stats: {
        best: this.toFiniteNumber(stats.best),
        worst: this.toFiniteNumber(stats.worst),
        avg: this.toFiniteNumber(stats.avg),
        win: this.toFiniteNumber(stats.win),
        loss: this.toFiniteNumber(stats.loss),
      },
      updatedAt: this.toIsoString(dailyPnl.updatedAt),
    };
  }

  private mapOpenOrders(payload: unknown): DashboardOpenOrdersDto {
    const openOrders = (payload ?? {}) as OpenOrdersPayload;
    const items = Array.isArray(openOrders.items)
      ? openOrders.items
          .map((item) => {
            const order = item as OpenOrderPayload;
            const side: 'BUY' | 'SELL' = order.side === 'SELL' ? 'SELL' : 'BUY';
            const type: 'Limit' | 'Market' | 'Stop' | 'TP' =
              order.type === 'Market' ||
              order.type === 'Stop' ||
              order.type === 'TP'
                ? order.type
                : 'Limit';
            const status: 'Open' | 'Partial' | 'Filled' | 'Cancelled' =
              order.status === 'Partial' ||
              order.status === 'Filled' ||
              order.status === 'Cancelled'
                ? order.status
                : 'Open';

            return {
              id: order.id ? String(order.id) : '',
              pair: order.pair ? String(order.pair) : '',
              side,
              type,
              price: this.toFiniteNumber(order.price),
              amount: this.toFiniteNumber(order.amount),
              filledPercent: this.toFiniteNumber(order.filledPercent),
              totalUsd: this.toFiniteNumber(order.totalUsd),
              status,
              createdAtLabel:
                typeof order.createdAtLabel === 'string' &&
                order.createdAtLabel.trim().length > 0
                  ? order.createdAtLabel
                  : '',
            };
          })
          .filter((item) => item.id.length > 0 && item.pair.length > 0)
      : [];

    return {
      activeCount: this.toFiniteNumber(openOrders.activeCount),
      totalCount: this.toFiniteNumber(openOrders.totalCount),
      items,
      updatedAt: this.toIsoString(openOrders.updatedAt),
    };
  }

  private createFallbackBtcPriceTrend(
    range: DashboardBtcPriceTrendDto['range'],
  ): DashboardBtcPriceTrendDto {
    return {
      range,
      currency: 'USD',
      livePrice: 0,
      change24h: 0,
      change24hPercent: 0,
      labels: [],
      series: [],
      high: 0,
      low: 0,
      updatedAt: new Date().toISOString(),
    };
  }

  private createFallbackVolumeProfile(
    timeframe: DashboardVolumeProfileDto['timeframe'],
  ): DashboardVolumeProfileDto {
    return {
      timeframe,
      labels: [],
      volume: [],
      colors: [],
      updatedAt: new Date().toISOString(),
    };
  }

  private createFallbackDailyPnl(range: DailyPnlRange): DashboardDailyPnlDto {
    return {
      range,
      weeklyNet: 0,
      series: [],
      stats: {
        best: 0,
        worst: 0,
        avg: 0,
        win: 0,
        loss: 0,
      },
      updatedAt: new Date().toISOString(),
    };
  }

  private createFallbackOpenOrders(): DashboardOpenOrdersDto {
    return {
      activeCount: 0,
      totalCount: 0,
      items: [],
      updatedAt: new Date().toISOString(),
    };
  }

  private createFallbackMarketComposition(): {
    marketOverview: DashboardMarketOverviewDto;
    marketShare: MarketShareItemDto[];
  } {
    return {
      marketOverview: {
        btcDominance: 0,
        fearGreedIndex: 50,
      },
      marketShare: [
        { symbol: 'BTC', dominance: 0 },
        { symbol: 'ETH', dominance: 0 },
        { symbol: 'OTHERS', dominance: 100 },
      ],
    };
  }

  private buildMarketCompositionSafely(
    tickers: Parameters<MarketDataService['buildDashboardMarketComposition']>[0],
    warnings: string[],
  ): {
    marketOverview: DashboardMarketOverviewDto;
    marketShare: MarketShareItemDto[];
  } {
    try {
      return this.marketDataService.buildDashboardMarketComposition(tickers);
    } catch (error) {
      warnings.push('market_overview_unavailable');
      this.logWarning(
        'MarketDataService.buildDashboardMarketComposition',
        error,
      );
      return this.createFallbackMarketComposition();
    }
  }

  private normalizeDailyPnlSeries(
    series: Array<{
      day: string;
      value: number;
    }>,
    range: DailyPnlRange = 'week',
  ): DashboardDailyPnlDto['series'] {
    const orderedDays: DashboardDailyPnlDto['series'][number]['day'][] =
      range === 'month'
        ? [
            'Apr 1',
            'Apr 2',
            'Apr 3',
            'Apr 4',
            'Apr 5',
            'Apr 6',
            'Apr 7',
            'Apr 8',
            'Apr 9',
            'Apr 10',
            'Apr 11',
            'Apr 12',
          ]
        : range === 'year'
          ? [
              'Jan',
              'Feb',
              'Mar',
              'Apr',
              'May',
              'Jun',
              'Jul',
              'Aug',
              'Sep',
              'Oct',
              'Nov',
              'Dec',
            ]
          : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return orderedDays.map((day) => {
      const matchedPoint = series.find((item) => item.day === day);
      return {
        day,
        value: matchedPoint?.value ?? 0,
      };
    });
  }

  private normalizePnlDay(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
  }

  private getFallbackHealth(): DashboardHealthDto {
    return {
      db: 'unknown',
      redis: 'unknown',
      wsConnections: 0,
    };
  }

  private normalizeWarnings(warnings: unknown): string[] {
    if (!Array.isArray(warnings)) {
      return [];
    }

    return warnings
      .filter((warning): warning is string => typeof warning === 'string')
      .map((warning) => warning.trim())
      .filter((warning) => warning.length > 0);
  }

  private toRequiredString(value: unknown): string {
    if (value === undefined || value === null || value === '') {
      return '0';
    }

    return String(value);
  }

  private toOptionalString(value: unknown): string | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    return String(value);
  }

  private toFiniteNumber(value: unknown): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  }

  private toIsoString(value: unknown): string {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return new Date(value).toISOString();
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    return new Date().toISOString();
  }

  private toHealthStatus(
    value: unknown,
  ): 'up' | 'down' | 'unknown' {
    return value === 'up' || value === 'down' || value === 'unknown'
      ? value
      : 'unknown';
  }

  private logWarning(source: string, error: unknown): void {
    this.logger.warn(
      `${source} failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }

  private async withSectionTimeout<T>(
    operation: Promise<T>,
    source: string,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new ServiceUnavailableException(
            `${source} timed out after ${DASHBOARD_SECTION_TIMEOUT_MS}ms`,
          ),
        );
      }, DASHBOARD_SECTION_TIMEOUT_MS);

      void operation.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }
}
