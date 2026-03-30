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
const cache_service_1 = require("../cache/cache.service");
const events_tokens_1 = require("../events/events.tokens");
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
let MarketDataService = MarketDataService_1 = class MarketDataService {
    binanceService;
    cacheService;
    marketEventsPublisher;
    logger = new common_1.Logger(MarketDataService_1.name);
    constructor(binanceService, cacheService, marketEventsPublisher) {
        this.binanceService = binanceService;
        this.cacheService = cacheService;
        this.marketEventsPublisher = marketEventsPublisher;
    }
    async getTrackedTickers(limit) {
        const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 5;
        const symbols = DEFAULT_MOVER_SYMBOLS.slice(0, safeLimit);
        const results = await Promise.allSettled(symbols.map(async (symbol) => {
            const hot = await this.cacheService.get(this.getHotCacheKey(symbol));
            if (hot)
                return this.toDashboardTickerDto(hot);
            const stale = await this.cacheService.get(this.getStaleCacheKey(symbol));
            if (stale)
                return this.toDashboardTickerDto(stale);
            return null;
        }));
        return results
            .filter((r) => r.status === 'fulfilled' && r.value !== null)
            .map((r) => r.value);
    }
    toDashboardTickerDto(ticker) {
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
    async getTicker(symbol) {
        const normalizedSymbol = this.normalizeSymbol(symbol);
        const hotCacheKey = this.getHotCacheKey(normalizedSymbol);
        const cachedTicker = await this.cacheService.get(hotCacheKey);
        if (cachedTicker) {
            this.logger.log(`Ticker hot cache hit for ${normalizedSymbol}`);
            await this.backfillStaleCacheIfMissing(normalizedSymbol, cachedTicker);
            return this.withCacheSource(cachedTicker, 'hot');
        }
        this.logger.log(`Ticker hot cache miss for ${normalizedSymbol}`);
        const lockKey = this.getLockKey(normalizedSymbol);
        const lockValue = `${process.pid}:${Date.now()}`;
        const lockAcquired = await this.cacheService.setNx(lockKey, lockValue, LOCK_TTL_SECONDS);
        if (lockAcquired) {
            this.logger.log(`Ticker lock acquired for ${normalizedSymbol}`);
            return this.fetchAndCacheTicker(normalizedSymbol, hotCacheKey, lockKey);
        }
        this.logger.log(`Ticker waiter subscribed for ${normalizedSymbol}`);
        return this.waitForFetcherOrFallback(normalizedSymbol, hotCacheKey);
    }
    async fetchAndCacheTicker(symbol, hotCacheKey, lockKey) {
        const channel = this.getChannelKey(symbol);
        const ticker = await this.getTickerFromBinanceOrFallback(symbol);
        if (this.isStaleTicker(ticker)) {
            await this.cacheService.del(lockKey);
            return ticker;
        }
        try {
            await this.writeTickerCaches(symbol, hotCacheKey, ticker);
        }
        finally {
            await this.cacheService.del(lockKey);
        }
        await this.publishTickerUpdate(symbol, channel, ticker);
        await this.broadcastFetcherUpdate(symbol, ticker);
        return this.withCacheSource(ticker, 'fresh');
    }
    async waitForFetcherOrFallback(symbol, hotCacheKey) {
        const channel = this.getChannelKey(symbol);
        const hotTicker = await this.cacheService.get(hotCacheKey);
        if (hotTicker) {
            this.logger.log(`Ticker hot cache won race for ${symbol}`);
            await this.backfillStaleCacheIfMissing(symbol, hotTicker);
            return this.withCacheSource(hotTicker, 'hot');
        }
        try {
            const publishedTicker = await this.cacheService.subscribeOnce(channel, WAITER_TIMEOUT_MS);
            if (publishedTicker) {
                return this.withCacheSource(publishedTicker, 'fresh');
            }
        }
        catch (error) {
            this.logger.warn(`Pub/sub wait failed for ${symbol}, falling back to stale cache`, error instanceof Error ? error.stack : undefined);
        }
        const cachedTicker = await this.cacheService.get(hotCacheKey);
        if (cachedTicker) {
            this.logger.log(`Ticker hot cache filled while waiting for ${symbol}`);
            await this.backfillStaleCacheIfMissing(symbol, cachedTicker);
            return this.withCacheSource(cachedTicker, 'hot');
        }
        return this.getStaleTickerOrThrow(symbol);
    }
    async getStaleTickerOrThrow(symbol) {
        const staleCacheKey = this.getStaleCacheKey(symbol);
        this.logger.warn(`Trying stale cache with key ${staleCacheKey}`);
        const staleTicker = await this.cacheService.get(staleCacheKey);
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
    async broadcastFetcherUpdate(symbol, ticker) {
        if (!this.marketEventsPublisher?.publishTicker) {
            return;
        }
        try {
            await this.marketEventsPublisher.publishTicker(`ticker:${symbol}`, ticker);
        }
        catch (error) {
            this.logger.warn(`Ticker websocket broadcast failed for ${symbol}`, error instanceof Error ? error.stack : undefined);
        }
    }
    async publishTickerUpdate(symbol, channel, ticker) {
        try {
            await this.cacheService.publish(channel, ticker);
        }
        catch (error) {
            this.logger.warn(`Ticker publish failed for ${symbol}`, error instanceof Error ? error.stack : undefined);
        }
    }
    async writeTickerCaches(symbol, hotCacheKey, ticker) {
        const staleCacheKey = this.getStaleCacheKey(symbol);
        const cachePayload = this.stripRuntimeCacheFlags(ticker);
        await this.cacheService.set(hotCacheKey, cachePayload, HOT_CACHE_TTL_SECONDS);
        await this.cacheService.set(staleCacheKey, cachePayload, STALE_CACHE_TTL_SECONDS);
        this.logger.log(`Ticker stale cache written with key ${staleCacheKey}`);
    }
    async backfillStaleCacheIfMissing(symbol, ticker) {
        const staleCacheKey = this.getStaleCacheKey(symbol);
        const staleTicker = await this.cacheService.get(staleCacheKey);
        if (staleTicker) {
            return;
        }
        await this.cacheService.set(staleCacheKey, this.stripRuntimeCacheFlags(ticker), STALE_CACHE_TTL_SECONDS);
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
    normalizeSymbol(symbol) {
        return symbol.trim().toUpperCase();
    }
    getHotCacheKey(symbol) {
        return `app:ticker:${symbol}:hot`;
    }
    getStaleCacheKey(symbol) {
        return `app:ticker:${symbol}:stale`;
    }
    getLockKey(symbol) {
        return `app:lock:ticker:${symbol}`;
    }
    getChannelKey(symbol) {
        return `app:ch:ticker:${symbol}`;
    }
};
exports.MarketDataService = MarketDataService;
exports.MarketDataService = MarketDataService = MarketDataService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Optional)()),
    __param(2, (0, common_1.Inject)(events_tokens_1.MARKET_EVENTS_PUBLISHER)),
    __metadata("design:paramtypes", [binance_service_1.BinanceService,
        cache_service_1.CacheService, Object])
], MarketDataService);
//# sourceMappingURL=market-data.service.js.map