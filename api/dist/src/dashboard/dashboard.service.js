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
const binance_service_1 = require("../binance/binance.service");
const market_data_service_1 = require("../market-data/market-data.service");
const orders_service_1 = require("../orders/orders.service");
const pnl_service_1 = require("../pnl/pnl.service");
const redis_service_1 = require("../redis/redis.service");
const users_service_1 = require("../users/users.service");
const internal_service_1 = require("../internal/internal.service");
const dashboard_cache_util_1 = require("./dashboard-cache.util");
const TOP_MOVERS_LIMIT = 5;
const DASHBOARD_HOT_CACHE_TTL_SECONDS = 30;
const DASHBOARD_STALE_CACHE_TTL_SECONDS = 300;
const DASHBOARD_SECTION_TIMEOUT_MS = 7000;
let DashboardService = DashboardService_1 = class DashboardService {
    usersService;
    binanceService;
    marketDataService;
    ordersService;
    pnlService;
    redisService;
    internalService;
    logger = new common_1.Logger(DashboardService_1.name);
    constructor(usersService, binanceService, marketDataService, ordersService, pnlService, redisService, internalService) {
        this.usersService = usersService;
        this.binanceService = binanceService;
        this.marketDataService = marketDataService;
        this.ordersService = ordersService;
        this.pnlService = pnlService;
        this.redisService = redisService;
        this.internalService = internalService;
    }
    async getAggregatedDashboard() {
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
    async getSummary(userId, rangeInput, volumeTfInput, pnlRangeInput) {
        const range = this.normalizeTrendRange(rangeInput);
        const volumeTf = this.normalizeVolumeTimeframe(volumeTfInput);
        const pnlRange = this.normalizeDailyPnlRange(pnlRangeInput);
        const hotCacheKey = this.getHotCacheKey(userId, range, volumeTf, pnlRange);
        const staleCacheKey = this.getStaleCacheKey(userId, range, volumeTf, pnlRange);
        try {
            const hotCachePayload = await this.redisService.get(hotCacheKey);
            const hotCache = this.parseSummaryCache(hotCachePayload);
            if (hotCache) {
                this.logger.log(`[Dashboard] cache hit: ${hotCacheKey}`);
                return hotCache;
            }
        }
        catch (error) {
            this.logger.warn(`[Dashboard] hot cache read failed: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
        this.logger.log(`[Dashboard] cache miss: ${hotCacheKey}`);
        let staleSummary = null;
        try {
            const staleSummaryPayload = await this.redisService.get(staleCacheKey);
            staleSummary = this.parseSummaryCache(staleSummaryPayload);
        }
        catch (error) {
            this.logger.warn(`Dashboard stale cache read failed: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
        try {
            const summary = await this.buildSummary(userId, range, volumeTf, pnlRange);
            await this.writeSummaryCaches(userId, range, volumeTf, pnlRange, summary);
            this.logger.log('[Dashboard] summary built successfully');
            return summary;
        }
        catch (error) {
            this.logger.error(`[Dashboard] summary build failed: ${error instanceof Error ? error.message : 'unknown error'}`, error instanceof Error ? error.stack : undefined);
            if (staleSummary) {
                this.logger.warn('Dashboard stale fallback hit');
                return {
                    ...staleSummary,
                    stale: true,
                };
            }
            throw new common_1.ServiceUnavailableException('Dashboard summary is temporarily unavailable');
        }
    }
    async buildSummary(userId, range, volumeTf, pnlRange) {
        if (process.env.FORCE_DASHBOARD_BUILD_FAIL === 'true') {
            this.logger.warn('Dashboard build forced to fail for testing');
            throw new Error('Dashboard build forced to fail for testing');
        }
        if (!this.marketDataService?.getTrackedTickers ||
            !this.marketDataService?.buildDashboardMarketComposition) {
            throw new common_1.ServiceUnavailableException('Dashboard market data services are temporarily unavailable');
        }
        const warnings = [];
        const healthPromise = this.internalService?.getQuickHealth
            ? this.internalService.getQuickHealth()
            : Promise.resolve({
                db: 'up',
                redis: 'up',
                wsConnections: 0,
            });
        const [userCountResult, topMoversResult, healthResult, btcPriceTrendResult, volumeProfileResult, dailyPnlResult, openOrdersResult,] = await Promise.allSettled([
            this.withSectionTimeout(this.usersService.getActiveCount(), 'UsersService.getActiveCount'),
            this.withSectionTimeout(this.marketDataService.getTrackedTickers(TOP_MOVERS_LIMIT), 'MarketDataService.getTrackedTickers'),
            this.withSectionTimeout(healthPromise, 'InternalService.getQuickHealth'),
            this.withSectionTimeout(this.marketDataService.getDashboardBtcPriceTrend(range), 'MarketDataService.getDashboardBtcPriceTrend'),
            this.withSectionTimeout(this.marketDataService.getDashboardVolumeProfile(volumeTf), 'MarketDataService.getDashboardVolumeProfile'),
            this.withSectionTimeout(this.pnlService.getWeeklyPnl(userId, pnlRange), 'PnlService.getWeeklyPnl'),
            this.withSectionTimeout(this.ordersService.getOpenOrders(userId), 'OrdersService.getOpenOrders'),
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
        const marketComposition = topMoversResult.status === 'fulfilled'
            ? this.buildMarketCompositionSafely(topMoversResult.value, warnings)
            : this.createFallbackMarketComposition();
        const health = healthResult.status === 'fulfilled'
            ? this.mapHealth(healthResult.value)
            : this.getFallbackHealth();
        if (healthResult.status === 'rejected') {
            warnings.push('internal_health_unavailable');
            this.logWarning('InternalService.getQuickHealth', healthResult.reason);
        }
        const btcPriceTrend = btcPriceTrendResult.status === 'fulfilled'
            ? btcPriceTrendResult.value
            : this.createFallbackBtcPriceTrend(range);
        if (btcPriceTrendResult.status === 'rejected') {
            warnings.push('btc_price_trend_unavailable');
            this.logWarning('MarketDataService.getDashboardBtcPriceTrend', btcPriceTrendResult.reason);
        }
        const volumeProfile = volumeProfileResult.status === 'fulfilled'
            ? volumeProfileResult.value
            : this.createFallbackVolumeProfile(volumeTf);
        if (volumeProfileResult.status === 'rejected') {
            warnings.push('volume_profile_unavailable');
            this.logWarning('MarketDataService.getDashboardVolumeProfile', volumeProfileResult.reason);
        }
        const dailyPnl = dailyPnlResult.status === 'fulfilled'
            ? this.mapDailyPnl(dailyPnlResult.value)
            : this.createFallbackDailyPnl(pnlRange);
        if (dailyPnlResult.status === 'rejected') {
            warnings.push('daily_pnl_unavailable');
            this.logWarning('PnlService.getWeeklyPnl', dailyPnlResult.reason);
        }
        const openOrders = openOrdersResult.status === 'fulfilled'
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
    async writeSummaryCaches(userId, range, volumeTf, pnlRange, summary) {
        const hotCacheKey = this.getHotCacheKey(userId, range, volumeTf, pnlRange);
        const staleCacheKey = this.getStaleCacheKey(userId, range, volumeTf, pnlRange);
        try {
            await Promise.all([
                this.redisService.set(hotCacheKey, summary, DASHBOARD_HOT_CACHE_TTL_SECONDS),
                this.redisService.set(staleCacheKey, summary, DASHBOARD_STALE_CACHE_TTL_SECONDS),
            ]);
        }
        catch (error) {
            this.logger.warn(`Dashboard cache write failed: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
    }
    normalizeTrendRange(rangeInput) {
        return rangeInput === '15m' ||
            rangeInput === '1h' ||
            rangeInput === '4h' ||
            rangeInput === '1d'
            ? rangeInput
            : '1h';
    }
    normalizeVolumeTimeframe(timeframeInput) {
        return timeframeInput === '15m' ||
            timeframeInput === '1h' ||
            timeframeInput === '4h' ||
            timeframeInput === '1d'
            ? timeframeInput
            : '1h';
    }
    normalizeDailyPnlRange(rangeInput) {
        return rangeInput === 'week' ||
            rangeInput === 'month' ||
            rangeInput === 'year'
            ? rangeInput
            : 'week';
    }
    getHotCacheKey(userId, range, volumeTf, pnlRange) {
        return (0, dashboard_cache_util_1.getDashboardSummaryHotCacheKey)(userId, range, volumeTf, pnlRange);
    }
    getStaleCacheKey(userId, range, volumeTf, pnlRange) {
        return (0, dashboard_cache_util_1.getDashboardSummaryStaleCacheKey)(userId, range, volumeTf, pnlRange);
    }
    parseSummaryCache(payload) {
        try {
            const parsed = typeof payload === 'string'
                ? JSON.parse(payload)
                : (payload ?? {});
            const hasBtcPriceTrend = parsed.btcPriceTrend !== undefined && parsed.btcPriceTrend !== null;
            const hasVolumeProfile = parsed.volumeProfile !== undefined && parsed.volumeProfile !== null;
            const hasDailyPnl = parsed.dailyPnl !== undefined && parsed.dailyPnl !== null;
            const hasOpenOrders = parsed.openOrders !== undefined && parsed.openOrders !== null;
            if (!hasBtcPriceTrend || !hasVolumeProfile || !hasDailyPnl || !hasOpenOrders) {
                this.logger.warn('Dashboard cache entry missing btcPriceTrend, volumeProfile, dailyPnl, or openOrders; forcing rebuild');
                return null;
            }
            return {
                userCount: typeof parsed.userCount === 'number' ? parsed.userCount : null,
                topMovers: this.mapTopMovers(parsed.topMovers),
                marketOverview: this.requireMarketOverview(parsed.marketOverview),
                marketShare: this.mapMarketShare(parsed.marketShare, this.requireMarketOverview(parsed.marketOverview)),
                btcPriceTrend: this.mapBtcPriceTrend(parsed.btcPriceTrend),
                volumeProfile: this.mapVolumeProfile(parsed.volumeProfile),
                dailyPnl: this.mapDailyPnl(parsed.dailyPnl),
                openOrders: this.mapOpenOrders(parsed.openOrders),
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
    requireMarketOverview(payload) {
        const overview = (payload ?? {});
        if (typeof overview.btcDominance !== 'number' ||
            !Number.isFinite(overview.btcDominance) ||
            typeof overview.fearGreedIndex !== 'number' ||
            !Number.isFinite(overview.fearGreedIndex)) {
            throw new Error('Dashboard cache entry missing a valid marketOverview');
        }
        return {
            btcDominance: overview.btcDominance,
            fearGreedIndex: overview.fearGreedIndex,
        };
    }
    mapMarketShare(payload, marketOverview) {
        if (!Array.isArray(payload)) {
            throw new Error('Dashboard cache entry missing a valid marketShare');
        }
        const items = payload
            .map((item) => {
            const marketShareItem = item;
            const dominance = typeof marketShareItem.dominance === 'number'
                ? marketShareItem.dominance
                : typeof marketShareItem.dominance === 'string'
                    ? Number(marketShareItem.dominance)
                    : NaN;
            return {
                symbol: marketShareItem.symbol ? String(marketShareItem.symbol) : '',
                dominance,
            };
        })
            .filter((item) => item.symbol.length > 0 && Number.isFinite(item.dominance));
        if (items.length === 0) {
            throw new Error('Dashboard cache entry missing a valid marketShare');
        }
        return items;
    }
    mapBtcPriceTrend(payload) {
        const trend = (payload ?? {});
        const labels = Array.isArray(trend.labels)
            ? trend.labels.filter((label) => typeof label === 'string')
            : [];
        const series = Array.isArray(trend.series)
            ? trend.series
                .map((value) => typeof value === 'number'
                ? value
                : typeof value === 'string'
                    ? Number(value)
                    : NaN)
                .filter((value) => Number.isFinite(value))
            : [];
        const pointCount = Math.min(labels.length, series.length);
        return {
            range: trend.range === '15m' ||
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
    mapVolumeProfile(payload) {
        const profile = (payload ?? {});
        const labels = Array.isArray(profile.labels)
            ? profile.labels.filter((label) => typeof label === 'string')
            : [];
        const volume = Array.isArray(profile.volume)
            ? profile.volume
                .map((value) => typeof value === 'number'
                ? value
                : typeof value === 'string'
                    ? Number(value)
                    : NaN)
                .filter((value) => Number.isFinite(value))
            : [];
        const colors = Array.isArray(profile.colors)
            ? profile.colors.filter((color) => typeof color === 'string')
            : [];
        const pointCount = Math.min(labels.length, volume.length, colors.length);
        return {
            timeframe: profile.timeframe === '15m' ||
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
    mapDailyPnl(payload) {
        const dailyPnl = (payload ?? {});
        const series = Array.isArray(dailyPnl.series)
            ? dailyPnl.series
                .map((item) => {
                const point = item;
                const value = typeof point.value === 'number'
                    ? point.value
                    : typeof point.value === 'string'
                        ? Number(point.value)
                        : NaN;
                return {
                    day: this.normalizePnlDay(point.day),
                    value,
                };
            })
                .filter((item) => item.day !== null && Number.isFinite(item.value))
            : [];
        const normalizedRange = dailyPnl.range === 'month' || dailyPnl.range === 'year'
            ? dailyPnl.range
            : 'week';
        const normalizedSeries = series.length > 0
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
    mapOpenOrders(payload) {
        const openOrders = (payload ?? {});
        const items = Array.isArray(openOrders.items)
            ? openOrders.items
                .map((item) => {
                const order = item;
                const side = order.side === 'SELL' ? 'SELL' : 'BUY';
                const type = order.type === 'Market' ||
                    order.type === 'Stop' ||
                    order.type === 'TP'
                    ? order.type
                    : 'Limit';
                const status = order.status === 'Partial' ||
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
                    createdAtLabel: typeof order.createdAtLabel === 'string' &&
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
    createFallbackBtcPriceTrend(range) {
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
    createFallbackVolumeProfile(timeframe) {
        return {
            timeframe,
            labels: [],
            volume: [],
            colors: [],
            updatedAt: new Date().toISOString(),
        };
    }
    createFallbackDailyPnl(range) {
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
    createFallbackOpenOrders() {
        return {
            activeCount: 0,
            totalCount: 0,
            items: [],
            updatedAt: new Date().toISOString(),
        };
    }
    createFallbackMarketComposition() {
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
    buildMarketCompositionSafely(tickers, warnings) {
        try {
            return this.marketDataService.buildDashboardMarketComposition(tickers);
        }
        catch (error) {
            warnings.push('market_overview_unavailable');
            this.logWarning('MarketDataService.buildDashboardMarketComposition', error);
            return this.createFallbackMarketComposition();
        }
    }
    normalizeDailyPnlSeries(series, range = 'week') {
        const orderedDays = range === 'month'
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
    normalizePnlDay(value) {
        return typeof value === 'string' && value.trim().length > 0 ? value : null;
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
    toFiniteNumber(value) {
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : 0;
        }
        if (typeof value === 'string') {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : 0;
        }
        return 0;
    }
    toIsoString(value) {
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
    toHealthStatus(value) {
        return value === 'up' || value === 'down' || value === 'unknown'
            ? value
            : 'unknown';
    }
    logWarning(source, error) {
        this.logger.warn(`${source} failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
    async withSectionTimeout(operation, source) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new common_1.ServiceUnavailableException(`${source} timed out after ${DASHBOARD_SECTION_TIMEOUT_MS}ms`));
            }, DASHBOARD_SECTION_TIMEOUT_MS);
            void operation.then((value) => {
                clearTimeout(timer);
                resolve(value);
            }, (error) => {
                clearTimeout(timer);
                reject(error);
            });
        });
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = DashboardService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(6, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        binance_service_1.BinanceService,
        market_data_service_1.MarketDataService,
        orders_service_1.OrdersService,
        pnl_service_1.PnlService,
        redis_service_1.RedisService,
        internal_service_1.InternalService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map