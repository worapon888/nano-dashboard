import {
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MarketDataService } from '../market-data/market-data.service';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import {
  DashboardHealthDto,
  DashboardSummaryDto,
  DashboardTopMoverDto,
} from './dto/dashboard-summary.dto';
import { InternalService } from '../internal/internal.service';

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

const TOP_MOVERS_LIMIT = 5;
const DASHBOARD_HOT_CACHE_KEY = 'app:dashboard:summary';
const DASHBOARD_STALE_CACHE_KEY = 'app:dashboard:summary:stale';
const DASHBOARD_HOT_CACHE_TTL_SECONDS = 30;
const DASHBOARD_STALE_CACHE_TTL_SECONDS = 300;

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly marketDataService: MarketDataService,
    private readonly redisService: RedisService,
    @Optional()
    private readonly internalService?: InternalService,
  ) {}

  async getSummary(): Promise<DashboardSummaryDto> {
    const client = this.redisService.getClient();

    try {
      const hotCache = await client.get(DASHBOARD_HOT_CACHE_KEY);

      if (hotCache) {
        const cachedSummary = this.parseSummaryCache(hotCache);

        if (cachedSummary) {
          return cachedSummary;
        }
      }
    } catch (error) {
      this.logger.warn(
        `Dashboard hot cache read failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }

    let staleCachePayload: string | null = null;

    try {
      const [, staleCache] = await client.mget(
        DASHBOARD_HOT_CACHE_KEY,
        DASHBOARD_STALE_CACHE_KEY,
      );
      staleCachePayload = staleCache;
    } catch (error) {
      this.logger.warn(
        `Dashboard stale cache read failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }

    try {
      const summary = await this.buildSummary();

      await this.writeSummaryCaches(summary);

      return summary;
    } catch (error) {
      this.logger.error(
        'Dashboard summary build failed',
        error instanceof Error ? error.stack : undefined,
      );

      if (staleCachePayload) {
        const staleSummary = this.parseSummaryCache(staleCachePayload);

        if (staleSummary) {
          this.logger.warn('Dashboard stale fallback hit');
          return {
            ...staleSummary,
            stale: true,
          };
        }
      }

      throw new ServiceUnavailableException(
        'Dashboard summary is temporarily unavailable',
      );
    }
  }

  private async buildSummary(): Promise<DashboardSummaryDto> {
    if (process.env.FORCE_DASHBOARD_BUILD_FAIL === 'true') {
      this.logger.warn('Dashboard build forced to fail for testing');
      throw new Error('Dashboard build forced to fail for testing');
    }

    if (!this.marketDataService?.getTrackedTickers) {
      return this.createFallbackResponse(['market_data_service_unavailable']);
    }

    const warnings: string[] = [];
    const healthPromise = this.internalService?.getQuickHealth
      ? this.internalService.getQuickHealth()
      : Promise.resolve({
          db: 'up' as const,
          redis: 'up' as const,
          wsConnections: 0,
        });

    const [userCountResult, topMoversResult, healthResult] =
      await Promise.allSettled([
        this.usersService.getActiveCount(),
        this.marketDataService.getTrackedTickers(TOP_MOVERS_LIMIT),
        healthPromise,
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

    const health =
      healthResult.status === 'fulfilled'
        ? this.mapHealth(healthResult.value)
        : this.getFallbackHealth();

    if (healthResult.status === 'rejected') {
      warnings.push('internal_health_unavailable');
      this.logWarning('InternalService.getQuickHealth', healthResult.reason);
    }

    return {
      userCount,
      topMovers,
      health,
      warnings: this.normalizeWarnings(warnings),
      generatedAt: new Date().toISOString(),
    };
  }

  private async writeSummaryCaches(summary: DashboardSummaryDto): Promise<void> {
    try {
      const client = this.redisService.getClient();
      const payload = JSON.stringify(summary);

      await client
        .multi()
        .set(
          DASHBOARD_HOT_CACHE_KEY,
          payload,
          'EX',
          DASHBOARD_HOT_CACHE_TTL_SECONDS,
        )
        .set(
          DASHBOARD_STALE_CACHE_KEY,
          payload,
          'EX',
          DASHBOARD_STALE_CACHE_TTL_SECONDS,
        )
        .exec();
    } catch (error) {
      this.logger.warn(
        `Dashboard cache write failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private createFallbackResponse(warnings: string[] = []): DashboardSummaryDto {
    return {
      userCount: null,
      topMovers: [],
      health: this.getFallbackHealth(),
      warnings: this.normalizeWarnings(warnings),
      generatedAt: new Date().toISOString(),
    };
  }

  private parseSummaryCache(payload: string): DashboardSummaryDto | null {
    try {
      const parsed = JSON.parse(payload) as Partial<DashboardSummaryDto>;

      return {
        userCount:
          typeof parsed.userCount === 'number' ? parsed.userCount : null,
        topMovers: this.mapTopMovers(parsed.topMovers),
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

  private toIsoString(value: unknown): string {
    if (typeof value === 'string' && value.length > 0) {
      return value;
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
}
