import { MarketDataService } from '../market-data/market-data.service';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import { DashboardSummaryDto } from './dto/dashboard-summary.dto';
import { InternalService } from '../internal/internal.service';
export declare class DashboardService {
    private readonly usersService;
    private readonly marketDataService;
    private readonly redisService;
    private readonly internalService?;
    private readonly logger;
    constructor(usersService: UsersService, marketDataService: MarketDataService, redisService: RedisService, internalService?: InternalService | undefined);
    getSummary(): Promise<DashboardSummaryDto>;
    private buildSummary;
    private writeSummaryCaches;
    private createFallbackResponse;
    private parseSummaryCache;
    private mapTopMovers;
    private mapHealth;
    private getFallbackHealth;
    private normalizeWarnings;
    private toRequiredString;
    private toOptionalString;
    private toIsoString;
    private toHealthStatus;
    private logWarning;
}
