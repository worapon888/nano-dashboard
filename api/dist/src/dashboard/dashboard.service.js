"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var DashboardService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const market_data_service_1 = require("../market-data/market-data.service");
const redis_service_1 = require("../redis/redis.service");
const users_service_1 = require("../users/users.service");
const internal_service_1 = require("../internal/internal.service");
const TOP_MOVERS_LIMIT = 5;
const DASHBOARD_HOT_CACHE_KEY = 'app:dashboard:summary';
const DASHBOARD_STALE_CACHE_KEY = 'app:dashboard:summary:stale';
const DASHBOARD_HOT_CACHE_TTL_SECONDS = 30;
const DASHBOARD_STALE_CACHE_TTL_SECONDS = 300;
let DashboardService = DashboardService_1 = class DashboardService {
    usersService;
    marketDataService;
    redisService;
    internalService;
    logger = new common_1.Logger(DashboardService_1.name);
    constructor(usersService, marketDataService, redisService, internalService) {
        this.usersService = usersService;
        this.marketDataService = marketDataService;
        this.redisService = redisService;
        this.internalService = internalService;
    }
    async getSummary() {
        const client = this.redisService.getClient();
        try {
            const hotCache = await client.get(DASHBOARD_HOT_CACHE_KEY);
            if (hotCache) {
                const cachedSummary = this.parseSummaryCache(hotCache);
                if (cachedSummary) {
                    return cachedSummary;
                }
            }
        }
        catch (error) {
            this.logger.warn(`Dashboard hot cache read failed: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
        let staleCachePayload = null;
        try {
            const [, staleCache] = await client.mget(DASHBOARD_HOT_CACHE_KEY, DASHBOARD_STALE_CACHE_KEY);
            staleCachePayload = staleCache;
        }
        catch (error) {
            this.logger.warn(`Dashboard stale cache read failed: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
        try {
            const summary = await this.buildSummary();
            await this.writeSummaryCaches(summary);
            return summary;
        }
        catch (error) {
            this.logger.error('Dashboard summary build failed', error instanceof Error ? error.stack : undefined);
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
            throw new common_1.ServiceUnavailableException('Dashboard summary is temporarily unavailable');
        }
    }
    async buildSummary() {
        if (process.env.FORCE_DASHBOARD_BUILD_FAIL === 'true') {
            this.logger.warn('Dashboard build forced to fail for testing');
            throw new Error('Dashboard build forced to fail for testing');
        }
        if (!this.marketDataService?.getTrackedTickers) {
            return this.createFallbackResponse(['market_data_service_unavailable']);
        }
        const warnings = [];
        const healthPromise = this.internalService?.getQuickHealth
            ? this.internalService.getQuickHealth()
            : Promise.resolve({
                db: 'up',
                redis: 'up',
                wsConnections: 0,
            });
        const [userCountResult, topMoversResult, healthResult] = await Promise.allSettled([
            this.usersService.getActiveCount(),
            this.marketDataService.getTrackedTickers(TOP_MOVERS_LIMIT),
            healthPromise,
        ]);
        const userCount = userCountResult.status === 'fulfilled' ? userCountResult.value : null;
        if (userCountResult.status === 'rejected') {
            warnings.push('user_count_unavailable');
            this.logWarning('UsersService.getActiveCount', userCountResult.reason);
        }
        const topMovers = topMoversResult.status === 'fulfilled'
            ? this.mapTopMovers(topMoversResult.value)
            : [];
        if (topMoversResult.status === 'rejected') {
            warnings.push('market_data_unavailable');
            this.logWarning('MarketDataService.getTrackedTickers', topMoversResult.reason);
        }
        const health = healthResult.status === 'fulfilled'
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
    async writeSummaryCaches(summary) {
        try {
            const client = this.redisService.getClient();
            const payload = JSON.stringify(summary);
            await client
                .multi()
                .set(DASHBOARD_HOT_CACHE_KEY, payload, 'EX', DASHBOARD_HOT_CACHE_TTL_SECONDS)
                .set(DASHBOARD_STALE_CACHE_KEY, payload, 'EX', DASHBOARD_STALE_CACHE_TTL_SECONDS)
                .exec();
        }
        catch (error) {
            this.logger.warn(`Dashboard cache write failed: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
    }
    createFallbackResponse(warnings = []) {
        return {
            userCount: null,
            topMovers: [],
            health: this.getFallbackHealth(),
            warnings: this.normalizeWarnings(warnings),
            generatedAt: new Date().toISOString(),
        };
    }
    parseSummaryCache(payload) {
        try {
            const parsed = JSON.parse(payload);
            return {
                userCount: typeof parsed.userCount === 'number' ? parsed.userCount : null,
                topMovers: this.mapTopMovers(parsed.topMovers),
                health: this.mapHealth(parsed.health),
                warnings: this.normalizeWarnings(parsed.warnings),
                ...(parsed.stale === true ? { stale: true } : {}),
                generatedAt: this.toIsoString(parsed.generatedAt),
            };
        }
        catch (error) {
            this.logger.warn(`Dashboard cache parse failed: ${error instanceof Error ? error.message : 'unknown error'}`);
            return null;
        }
    }
    mapTopMovers(payload) {
        if (!Array.isArray(payload)) {
            return [];
        }
        return payload.slice(0, TOP_MOVERS_LIMIT).map((item) => {
            const mover = item;
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
    mapHealth(payload) {
        const health = (payload ?? {});
        return {
            db: this.toHealthStatus(health.db),
            redis: this.toHealthStatus(health.redis),
            wsConnections: typeof health.wsConnections === 'number' ? health.wsConnections : 0,
        };
    }
    getFallbackHealth() {
        return {
            db: 'unknown',
            redis: 'unknown',
            wsConnections: 0,
        };
    }
    normalizeWarnings(warnings) {
        if (!Array.isArray(warnings)) {
            return [];
        }
        return warnings
            .filter((warning) => typeof warning === 'string')
            .map((warning) => warning.trim())
            .filter((warning) => warning.length > 0);
    }
    toRequiredString(value) {
        if (value === undefined || value === null || value === '') {
            return '0';
        }
        return String(value);
    }
    toOptionalString(value) {
        if (value === undefined || value === null || value === '') {
            return null;
        }
        return String(value);
    }
    toIsoString(value) {
        if (typeof value === 'string' && value.length > 0) {
            return value;
        }
        if (value instanceof Date) {
            return value.toISOString();
        }
        return new Date().toISOString();
    }
    toHealthStatus(value) {
        return value === 'up' || value === 'down' || value === 'unknown'
            ? value
            : 'unknown';
    }
    logWarning(source, error) {
        this.logger.warn(`${source} failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = DashboardService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        market_data_service_1.MarketDataService,
        redis_service_1.RedisService,
        internal_service_1.InternalService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map