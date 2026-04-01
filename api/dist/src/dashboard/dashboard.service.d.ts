import { BinanceService } from '../binance/binance.service';
import { MarketDataService } from '../market-data/market-data.service';
import { OrdersService } from '../orders/orders.service';
import { PnlService } from '../pnl/pnl.service';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import { DashboardSummaryDto } from './dto/dashboard-summary.dto';
import { InternalService } from '../internal/internal.service';
export declare class DashboardService {
    private readonly usersService;
    private readonly binanceService;
    private readonly marketDataService;
    private readonly ordersService;
    private readonly pnlService;
    private readonly redisService;
    private readonly internalService?;
    private readonly logger;
    constructor(usersService: UsersService, binanceService: BinanceService, marketDataService: MarketDataService, ordersService: OrdersService, pnlService: PnlService, redisService: RedisService, internalService?: InternalService | undefined);
    getAggregatedDashboard(): Promise<{
        users: {
            total: number;
            active: number;
            list: Awaited<ReturnType<UsersService['getDashboardUsersSnapshot']>>['list'];
        };
        market: {
            BTCUSDT: {
                price: string;
                cachedAt: string;
            };
            ETHUSDT: {
                price: string;
                cachedAt: string;
            };
        };
    }>;
    getSummary(userId: string, rangeInput?: string, volumeTfInput?: string, pnlRangeInput?: string): Promise<DashboardSummaryDto>;
    private buildSummary;
    private writeSummaryCaches;
    private normalizeTrendRange;
    private normalizeVolumeTimeframe;
    private normalizeDailyPnlRange;
    private getHotCacheKey;
    private getStaleCacheKey;
    private parseSummaryCache;
    private mapTopMovers;
    private mapHealth;
    private requireMarketOverview;
    private mapMarketShare;
    private mapBtcPriceTrend;
    private mapVolumeProfile;
    private mapDailyPnl;
    private mapOpenOrders;
    private createFallbackBtcPriceTrend;
    private createFallbackVolumeProfile;
    private createFallbackDailyPnl;
    private createFallbackOpenOrders;
    private createFallbackMarketComposition;
    private buildMarketCompositionSafely;
    private normalizeDailyPnlSeries;
    private normalizePnlDay;
    private getFallbackHealth;
    private normalizeWarnings;
    private toRequiredString;
    private toOptionalString;
    private toFiniteNumber;
    private toIsoString;
    private toHealthStatus;
    private logWarning;
    private withSectionTimeout;
}
