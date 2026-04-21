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
var MarketDataService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketDataService = void 0;
const common_1 = require("@nestjs/common");
const binance_service_1 = require("../binance/binance.service");
const events_tokens_1 = require("../events/events.tokens");
const redis_service_1 = require("../redis/redis.service");
const market_data_helpers_1 = require("./market-data.helpers");
const HOT_CACHE_TTL_SECONDS = 10;
const STALE_CACHE_TTL_SECONDS = 120;
const LOCK_TTL_SECONDS = 5;
const WAITER_TIMEOUT_MS = 6000;
const DEFAULT_MOVER_SYMBOLS = [
    'BTCUSDT',
    'ETHUSDT',
    'SOLUSDT',
    'BNBUSDT',
    'XRPUSDT',
];
const BTC_TREND_SYMBOL = 'BTCUSDT';
const BTC_PRICE_UPDATED_EVENT = 'btc.price.updated';
const BTC_TREND_CONFIG = {
    day: { interval: '1h', limit: 24 },
    week: { interval: '4h', limit: 42 },
    month: { interval: '1d', limit: 30 },
};
const DASHBOARD_BTC_TREND_CONFIG = {
    '15m': { interval: '15m', limit: 24 },
    '1h': { interval: '1h', limit: 24 },
    '4h': { interval: '4h', limit: 21 },
    '1d': { interval: '1d', limit: 21 },
};
const DASHBOARD_VOLUME_PROFILE_CONFIG = {
    '15m': { interval: '15m', limit: 28 },
    '1h': { interval: '1h', limit: 28 },
    '4h': { interval: '4h', limit: 18 },
    '1d': { interval: '1d', limit: 16 },
};
let MarketDataService = MarketDataService_1 = class MarketDataService {
    binanceService;
    redisService;
    marketEventsPublisher;
    logger = new common_1.Logger(MarketDataService_1.name);
    constructor(binanceService, redisService, marketEventsPublisher) {
        this.binanceService = binanceService;
        this.redisService = redisService;
        this.marketEventsPublisher = marketEventsPublisher;
    }
    async getTrackedTickers(limit) {
        const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 5;
        const symbols = DEFAULT_MOVER_SYMBOLS.slice(0, safeLimit);
        const results = await Promise.allSettled(symbols.map(async (symbol) => {
            const hot = await this.redisService.get((0, market_data_helpers_1.getHotCacheKey)(symbol));
            if (hot)
                return (0, market_data_helpers_1.toDashboardTickerDto)(hot);
            const stale = await this.redisService.get((0, market_data_helpers_1.getStaleCacheKey)(symbol));
            if (stale)
                return (0, market_data_helpers_1.toDashboardTickerDto)(stale);
            try {
                const freshTicker = await this.getTicker(symbol);
                return (0, market_data_helpers_1.toDashboardTickerDto)(freshTicker);
            }
            catch (error) {
                this.logger.warn(`Tracked ticker unavailable for ${symbol}: ${error instanceof Error ? error.message : 'unknown error'}`);
                return null;
            }
        }));
        return results
            .filter((r) => r.status === 'fulfilled' && r.value !== null)
            .map((r) => r.value);
    }
    async getBtcPriceTrend(range) {
        const config = BTC_TREND_CONFIG[range];
        if (!config) {
            throw new common_1.ServiceUnavailableException(`Unsupported BTC price trend range: ${range}`);
        }
        try {
            const [ticker, klines] = await Promise.all([
                this.getTicker(BTC_TREND_SYMBOL),
                this.binanceService.getKlines(BTC_TREND_SYMBOL, config.interval, config.limit),
            ]);
            return (0, market_data_helpers_1.toBtcPriceTrendDto)(range, ticker, klines);
        }
        catch (error) {
            if (this.isBinanceUnavailableError(error)) {
                this.logger.warn(`BTC price trend unavailable for ${range}: ${error instanceof Error ? error.message : 'unknown error'}`);
                throw new common_1.ServiceUnavailableException(`BTC price trend is temporarily unavailable for ${range}`);
            }
            throw error;
        }
    }
    async getDashboardBtcPriceTrend(range) {
        const config = DASHBOARD_BTC_TREND_CONFIG[range];
        if (!config) {
            throw new common_1.ServiceUnavailableException(`Unsupported BTC price trend range: ${range}`);
        }
        try {
            const [ticker, klines] = await Promise.all([
                this.binanceService.getTicker(BTC_TREND_SYMBOL),
                this.binanceService.getKlines(BTC_TREND_SYMBOL, config.interval, config.limit),
            ]);
            return (0, market_data_helpers_1.toDashboardBtcPriceTrendDto)(range, ticker, klines);
        }
        catch (error) {
            if (this.isBinanceUnavailableError(error)) {
                this.logger.warn(`Dashboard BTC price trend unavailable for ${range}: ${error instanceof Error ? error.message : 'unknown error'}`);
                throw new common_1.ServiceUnavailableException(`BTC price trend is temporarily unavailable for ${range}`);
            }
            throw error;
        }
    }
    async getDashboardVolumeProfile(timeframe) {
        const config = DASHBOARD_VOLUME_PROFILE_CONFIG[timeframe];
        if (!config) {
            throw new common_1.ServiceUnavailableException(`Unsupported volume profile timeframe: ${timeframe}`);
        }
        try {
            const klines = await this.binanceService.getKlines(BTC_TREND_SYMBOL, config.interval, config.limit);
            return (0, market_data_helpers_1.toDashboardVolumeProfileDto)(timeframe, klines);
        }
        catch (error) {
            if (this.isBinanceUnavailableError(error)) {
                this.logger.warn(`Dashboard volume profile unavailable for ${timeframe}: ${error instanceof Error ? error.message : 'unknown error'}`);
                throw new common_1.ServiceUnavailableException(`Volume profile is temporarily unavailable for ${timeframe}`);
            }
            throw error;
        }
    }
    buildDashboardMarketComposition(tickers) {
        return (0, market_data_helpers_1.buildDashboardMarketComposition)(tickers);
    }
    async getTicker(symbol) {
        const normalizedSymbol = (0, market_data_helpers_1.normalizeSymbol)(symbol);
        const redisClient = this.redisService.getClient();
        const redisReady = this.redisService.isReady();
        if (!redisClient || !redisReady) {
            this.logger.warn(`Redis unavailable; fetching ticker directly for ${normalizedSymbol}`);
            const directTicker = await this.getTickerFromBinanceOrFallbackWithoutRedis(normalizedSymbol);
            return this.isStaleTicker(directTicker)
                ? directTicker
                : this.withCacheSource(directTicker, 'fresh');
        }
        const hotCacheKey = (0, market_data_helpers_1.getHotCacheKey)(normalizedSymbol);
        const cachedTicker = await this.redisService.get(hotCacheKey);
        if (cachedTicker) {
            this.logger.log(`Ticker hot cache hit for ${normalizedSymbol}`);
            await this.backfillStaleCacheIfMissing(normalizedSymbol, cachedTicker);
            return this.withCacheSource(cachedTicker, 'hot');
        }
        this.logger.log(`Ticker hot cache miss for ${normalizedSymbol}`);
        const lockKey = (0, market_data_helpers_1.getLockKey)(normalizedSymbol);
        const lockValue = `${process.pid}:${Date.now()}`;
        const lockAcquired = await this.redisService.setNx(lockKey, lockValue, LOCK_TTL_SECONDS);
        if (lockAcquired) {
            this.logger.log(`Ticker lock acquired for ${normalizedSymbol}`);
            return this.fetchAndCacheTicker(normalizedSymbol, hotCacheKey, lockKey);
        }
        this.logger.log(`Ticker waiter subscribed for ${normalizedSymbol}`);
        return this.waitForFetcherOrFallback(normalizedSymbol, hotCacheKey);
    }
    async fetchAndCacheTicker(symbol, hotCacheKey, lockKey) {
        const channel = (0, market_data_helpers_1.getChannelKey)(symbol);
        const ticker = await this.getTickerFromBinanceOrFallback(symbol);
        if (this.isStaleTicker(ticker)) {
            await this.redisService.del(lockKey);
            return ticker;
        }
        try {
            await this.writeTickerCaches(symbol, hotCacheKey, ticker);
        }
        finally {
            await this.redisService.del(lockKey);
        }
        await this.publishTickerUpdate(symbol, channel, ticker);
        await this.broadcastFetcherUpdate(symbol, ticker);
        return this.withCacheSource(ticker, 'fresh');
    }
    async waitForFetcherOrFallback(symbol, hotCacheKey) {
        const channel = (0, market_data_helpers_1.getChannelKey)(symbol);
        const hotTicker = await this.redisService.get(hotCacheKey);
        if (hotTicker) {
            this.logger.log(`Ticker hot cache won race for ${symbol}`);
            await this.backfillStaleCacheIfMissing(symbol, hotTicker);
            return this.withCacheSource(hotTicker, 'hot');
        }
        try {
            const publishedTicker = await this.redisService.subscribeOnce(channel, WAITER_TIMEOUT_MS);
            if (publishedTicker) {
                return this.withCacheSource(publishedTicker, 'fresh');
            }
        }
        catch (error) {
            this.logger.warn(`Pub/sub wait failed for ${symbol}, falling back to stale cache`, error instanceof Error ? error.stack : undefined);
        }
        const cachedTicker = await this.redisService.get(hotCacheKey);
        if (cachedTicker) {
            this.logger.log(`Ticker hot cache filled while waiting for ${symbol}`);
            await this.backfillStaleCacheIfMissing(symbol, cachedTicker);
            return this.withCacheSource(cachedTicker, 'hot');
        }
        return this.getStaleTickerOrThrow(symbol);
    }
    async getStaleTickerOrThrow(symbol) {
        const staleCacheKey = (0, market_data_helpers_1.getStaleCacheKey)(symbol);
        this.logger.warn(`Trying stale cache with key ${staleCacheKey}`);
        const staleTicker = await this.redisService.get(staleCacheKey);
        if (staleTicker) {
            this.logger.warn(`Ticker stale fallback served for ${symbol}`);
            return this.withCacheSource(staleTicker, 'stale');
        }
        this.logger.warn(`Stale cache miss for key ${staleCacheKey}`);
        this.logger.error(`No fresh or stale market data available for ${symbol}`);
        throw new common_1.ServiceUnavailableException(`Ticker data is temporarily unavailable for ${symbol}`);
    }
    async getTickerFromBinanceOrFallback(symbol) {
        try {
            const ticker = await this.binanceService.getTicker(symbol);
            if (this.isUnavailableTicker(ticker)) {
                throw new binance_service_1.BinanceUnavailableException(`Fallback ticker payload returned for ${symbol}`);
            }
            this.logger.log(`Ticker Binance fetch success for ${symbol}`);
            return this.stripRuntimeCacheFlags(ticker);
        }
        catch (error) {
            if (this.isBinanceUnavailableError(error)) {
                return this.getStaleTickerOrThrow(symbol);
            }
            throw error;
        }
    }
    async getTickerFromBinanceOrFallbackWithoutRedis(symbol) {
        try {
            const ticker = await this.binanceService.getTicker(symbol);
            if (this.isUnavailableTicker(ticker)) {
                throw new binance_service_1.BinanceUnavailableException(`Fallback ticker payload returned for ${symbol}`);
            }
            this.logger.log(`Ticker direct Binance fetch success for ${symbol}`);
            return this.stripRuntimeCacheFlags(ticker);
        }
        catch (error) {
            if (this.isBinanceUnavailableError(error)) {
                this.logger.warn(`Ticker direct fetch unavailable for ${symbol} and Redis is disabled`);
            }
            throw error;
        }
    }
    async broadcastFetcherUpdate(symbol, ticker) {
        if (!this.marketEventsPublisher?.publishTicker) {
            return;
        }
        try {
            await this.marketEventsPublisher.publishTicker(`ticker:${symbol}`, ticker);
            const btcLiveUpdate = (0, market_data_helpers_1.toBtcLivePriceUpdate)(symbol, BTC_TREND_SYMBOL, ticker);
            if (btcLiveUpdate) {
                await this.marketEventsPublisher.publishTicker(BTC_PRICE_UPDATED_EVENT, btcLiveUpdate);
            }
        }
        catch (error) {
            this.logger.warn(`Ticker websocket broadcast failed for ${symbol}`, error instanceof Error ? error.stack : undefined);
        }
    }
    async publishTickerUpdate(symbol, channel, ticker) {
        try {
            await this.redisService.publish(channel, ticker);
        }
        catch (error) {
            this.logger.warn(`Ticker publish failed for ${symbol}`, error instanceof Error ? error.stack : undefined);
        }
    }
    async writeTickerCaches(symbol, hotCacheKey, ticker) {
        const staleCacheKey = (0, market_data_helpers_1.getStaleCacheKey)(symbol);
        const cachePayload = this.stripRuntimeCacheFlags(ticker);
        await this.redisService.set(hotCacheKey, cachePayload, HOT_CACHE_TTL_SECONDS);
        await this.redisService.set(staleCacheKey, cachePayload, STALE_CACHE_TTL_SECONDS);
        this.logger.log(`Ticker caches written: hot=${hotCacheKey}, stale=${staleCacheKey}`);
    }
    async backfillStaleCacheIfMissing(symbol, ticker) {
        const staleCacheKey = (0, market_data_helpers_1.getStaleCacheKey)(symbol);
        const staleTicker = await this.redisService.get(staleCacheKey);
        if (staleTicker) {
            return;
        }
        await this.redisService.set(staleCacheKey, this.stripRuntimeCacheFlags(ticker), STALE_CACHE_TTL_SECONDS);
        this.logger.log(`Ticker stale cache written with key ${staleCacheKey}`);
    }
    isBinanceUnavailableError(error) {
        return (error instanceof binance_service_1.BinanceUnavailableException ||
            error instanceof common_1.ServiceUnavailableException);
    }
    withCacheSource(ticker, cacheSource) {
        return {
            ...this.stripRuntimeCacheFlags(ticker),
            cacheSource,
            ...(cacheSource === 'stale' ? { stale: true } : {}),
        };
    }
    stripRuntimeCacheFlags(ticker) {
        const { cacheSource: _cacheSource, stale: _stale, ...baseTicker } = ticker;
        return baseTicker;
    }
    isStaleTicker(ticker) {
        return ticker.cacheSource === 'stale' || ticker.stale === true;
    }
    isUnavailableTicker(ticker) {
        if (ticker.stale === true || ticker.source === 'fallback') {
            return true;
        }
        const price = (0, market_data_helpers_1.toFiniteNumber)(ticker.price);
        const volume24h = (0, market_data_helpers_1.toFiniteNumber)(ticker.volume24h);
        return price <= 0 || volume24h <= 0;
    }
};
exports.MarketDataService = MarketDataService;
exports.MarketDataService = MarketDataService = MarketDataService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Optional)()),
    __param(2, (0, common_1.Inject)(events_tokens_1.MARKET_EVENTS_PUBLISHER)),
    __metadata("design:paramtypes", [binance_service_1.BinanceService,
        redis_service_1.RedisService, Object])
], MarketDataService);
//# sourceMappingURL=market-data.service.js.map