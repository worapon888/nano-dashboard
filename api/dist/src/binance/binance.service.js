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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var BinanceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BinanceService = exports.BinanceUnavailableException = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const rxjs_1 = require("rxjs");
const cache_service_1 = require("../redis/cache.service");
const ws_1 = __importDefault(require("ws"));
const BINANCE_REQUEST_TIMEOUT_MS = 5000;
const BINANCE_MAX_ATTEMPTS = 4;
const BINANCE_PRICE_CACHE_TTL_SECONDS = 30;
const BINANCE_PRICE_RECONNECT_BASE_DELAY_MS = 1000;
const BINANCE_PRICE_RECONNECT_MAX_DELAY_MS = 30000;
const DEFAULT_BINANCE_WS_BASE_URL = 'wss://stream.binance.com:9443/ws';
const RETRYABLE_HTTP_STATUS_CODES = new Set([429, 502, 503, 504]);
const NON_RETRYABLE_HTTP_STATUS_CODES = new Set([400, 403, 418]);
const RETRYABLE_NETWORK_CODES = new Set([
    'ECONNABORTED',
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
]);
class BinanceUnavailableException extends common_1.ServiceUnavailableException {
    constructor(message = 'Binance market data is temporarily unavailable') {
        super(message);
    }
}
exports.BinanceUnavailableException = BinanceUnavailableException;
let BinanceService = BinanceService_1 = class BinanceService {
    httpService;
    configService;
    cacheService;
    baseUrl;
    wsBaseUrl;
    logger = new common_1.Logger(BinanceService_1.name);
    subscriptions = new Map();
    trackedSymbols = new Set();
    constructor(httpService, configService, cacheService) {
        this.httpService = httpService;
        this.configService = configService;
        this.cacheService = cacheService;
        this.baseUrl = this.configService.getOrThrow('BINANCE_BASE_URL');
        this.wsBaseUrl =
            this.configService.get('BINANCE_WS_BASE_URL') ??
                DEFAULT_BINANCE_WS_BASE_URL;
    }
    async onModuleDestroy() {
        this.subscriptions.forEach((state) => {
            if (state.reconnectTimer) {
                clearTimeout(state.reconnectTimer);
            }
            if (state.socket) {
                state.socket.removeAllListeners();
                state.socket.close();
            }
        });
        this.subscriptions.clear();
    }
    async getPrice(symbol) {
        const normalizedSymbol = symbol.toUpperCase();
        const cacheKey = this.getPriceCacheKey(normalizedSymbol);
        try {
            const cachedValue = await this.cacheService.get(cacheKey);
            if (cachedValue) {
                const parsed = this.parseCachedPriceData(cachedValue, normalizedSymbol);
                if (parsed) {
                    return {
                        ...parsed,
                        source: parsed.source === 'stream' ? 'stream' : 'cache',
                    };
                }
            }
            const payload = await this.requestWithRetry(normalizedSymbol, '/api/v3/ticker/price', { symbol: normalizedSymbol }, 'price');
            const data = {
                symbol: normalizedSymbol,
                price: this.toStringValue(payload.price) ?? '0',
                fetchedAt: new Date().toISOString(),
                source: 'rest',
            };
            await this.cacheService.set(cacheKey, JSON.stringify(data), BINANCE_PRICE_CACHE_TTL_SECONDS);
            return data;
        }
        catch (error) {
            this.logger.error(`Binance price lookup failed for ${normalizedSymbol}: ${error instanceof Error ? error.message : 'unknown error'}`);
            return {
                symbol: normalizedSymbol,
                price: '0',
                fetchedAt: new Date().toISOString(),
                source: 'fallback',
                stale: true,
            };
        }
    }
    subscribeRealtime(symbol) {
        const normalizedSymbol = symbol.toUpperCase();
        if (this.subscriptions.has(normalizedSymbol)) {
            return;
        }
        this.trackedSymbols.add(normalizedSymbol);
        this.subscriptions.set(normalizedSymbol, {
            socket: null,
            reconnectTimer: null,
            retryCount: 0,
        });
        this.connectRealtime(normalizedSymbol);
    }
    async refreshTrackedSymbols() {
        const symbols = Array.from(this.trackedSymbols);
        await Promise.all(symbols.map(async (symbol) => {
            const price = await this.getPrice(symbol);
            if (price.source === 'fallback') {
                this.logger.warn(`Scheduled Binance refresh returned fallback data for ${symbol}`);
            }
        }));
    }
    async getTicker(symbol) {
        const normalizedSymbol = symbol.toUpperCase();
        try {
            const payload = await this.requestWithRetry(normalizedSymbol, '/api/v3/ticker/24hr', { symbol: normalizedSymbol }, 'ticker');
            return this.toTickerDto(normalizedSymbol, payload);
        }
        catch (error) {
            this.logger.error(`Binance ticker fetch failed for ${normalizedSymbol}: ${error instanceof Error ? error.message : 'unknown error'}`);
            return {
                symbol: normalizedSymbol,
                price: '0',
                volume24h: null,
                priceChange24h: null,
                priceChange24hPercent: null,
                high24h: null,
                low24h: null,
                fetchedAt: new Date().toISOString(),
                source: 'fallback',
                stale: true,
            };
        }
    }
    async getKlines(symbol, interval, limit) {
        const normalizedSymbol = symbol.toUpperCase();
        const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 1;
        try {
            return await this.requestWithRetry(normalizedSymbol, '/api/v3/klines', {
                symbol: normalizedSymbol,
                interval,
                limit: safeLimit,
            }, `klines:${interval}`);
        }
        catch (error) {
            this.logger.error(`Binance klines fetch failed for ${normalizedSymbol} (${interval}): ${error instanceof Error ? error.message : 'unknown error'}`);
            return [];
        }
    }
    connectRealtime(symbol) {
        const state = this.subscriptions.get(symbol);
        if (!state) {
            return;
        }
        const wsUrl = `${this.wsBaseUrl.replace(/\/$/, '')}/${symbol.toLowerCase()}@ticker`;
        this.logger.log(`Connecting Binance realtime stream: ${wsUrl}`);
        try {
            const socket = new ws_1.default(wsUrl);
            state.socket = socket;
            socket.on('open', () => {
                state.retryCount = 0;
                this.logger.log(`Binance realtime stream connected for ${symbol}`);
            });
            socket.on('message', (rawMessage) => {
                void this.handleRealtimeMessage(symbol, rawMessage);
            });
            socket.on('error', (error) => {
                this.logger.warn(`Binance realtime stream error for ${symbol}: ${error.message}`);
            });
            socket.on('close', (code, reason) => {
                const readableReason = typeof reason === 'string'
                    ? reason
                    : Buffer.isBuffer(reason)
                        ? reason.toString('utf-8')
                        : '';
                this.logger.warn(`Binance realtime stream closed for ${symbol} (code=${code}, reason=${readableReason || 'n/a'})`);
                this.scheduleReconnect(symbol);
            });
        }
        catch (error) {
            this.logger.error(`Binance realtime stream setup failed for ${symbol}: ${error instanceof Error ? error.message : 'unknown error'}`);
            this.scheduleReconnect(symbol);
        }
    }
    async handleRealtimeMessage(symbol, rawMessage) {
        try {
            const payload = JSON.parse(rawMessage.toString());
            const data = {
                symbol,
                price: this.toStringValue(payload.c) ?? '0',
                fetchedAt: new Date().toISOString(),
                source: 'stream',
            };
            await this.cacheService.set(this.getPriceCacheKey(symbol), JSON.stringify(data), BINANCE_PRICE_CACHE_TTL_SECONDS);
        }
        catch (error) {
            this.logger.warn(`Failed to process Binance realtime message for ${symbol}: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
    }
    scheduleReconnect(symbol) {
        const state = this.subscriptions.get(symbol);
        if (!state) {
            return;
        }
        if (state.reconnectTimer) {
            clearTimeout(state.reconnectTimer);
        }
        state.retryCount += 1;
        const delayMs = Math.min(BINANCE_PRICE_RECONNECT_BASE_DELAY_MS * 2 ** (state.retryCount - 1), BINANCE_PRICE_RECONNECT_MAX_DELAY_MS);
        this.logger.warn(`Scheduling Binance realtime reconnect for ${symbol} in ${delayMs}ms (retry ${state.retryCount})`);
        state.reconnectTimer = setTimeout(() => {
            state.reconnectTimer = null;
            this.connectRealtime(symbol);
        }, delayMs);
    }
    getPriceCacheKey(symbol) {
        return `binance:price:${symbol}`;
    }
    parseCachedPriceData(value, symbol) {
        try {
            const parsed = JSON.parse(value);
            if (typeof parsed.price !== 'string') {
                return null;
            }
            return {
                symbol,
                price: parsed.price,
                fetchedAt: typeof parsed.fetchedAt === 'string'
                    ? parsed.fetchedAt
                    : new Date().toISOString(),
                source: parsed.source === 'stream' ||
                    parsed.source === 'rest' ||
                    parsed.source === 'cache' ||
                    parsed.source === 'fallback'
                    ? parsed.source
                    : 'cache',
                stale: parsed.stale === true,
            };
        }
        catch {
            return null;
        }
    }
    toTickerDto(normalizedSymbol, payload) {
        return {
            symbol: normalizedSymbol,
            price: this.toStringValue(payload.lastPrice) ?? '0',
            volume24h: this.toStringValue(payload.volume),
            priceChange24h: this.toStringValue(payload.priceChange),
            priceChange24hPercent: this.toStringValue(payload.priceChangePercent),
            high24h: this.toStringValue(payload.highPrice),
            low24h: this.toStringValue(payload.lowPrice),
            fetchedAt: new Date().toISOString(),
            source: 'binance',
        };
    }
    async requestWithRetry(normalizedSymbol, path, params, requestLabel) {
        let lastError;
        for (let attempt = 1; attempt <= BINANCE_MAX_ATTEMPTS; attempt++) {
            try {
                const response = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.baseUrl}${path}`, {
                    params,
                    timeout: BINANCE_REQUEST_TIMEOUT_MS,
                }));
                return response.data;
            }
            catch (error) {
                lastError = error;
                if (!this.shouldRetry(error) || attempt === BINANCE_MAX_ATTEMPTS) {
                    break;
                }
                const delayMs = this.getRetryDelayMs(attempt);
                const axiosError = error;
                const detail = axiosError?.response?.status ?? axiosError?.code ?? 'unknown';
                this.logger.warn(`Retrying Binance ${requestLabel} fetch for ${normalizedSymbol} (attempt ${attempt}, detail ${detail})`);
                await this.sleep(delayMs);
            }
        }
        const unavailableException = this.toUnavailableException(normalizedSymbol, lastError, requestLabel);
        throw unavailableException;
    }
    shouldRetry(error) {
        const axiosError = error;
        const statusCode = axiosError?.response?.status;
        if (statusCode && NON_RETRYABLE_HTTP_STATUS_CODES.has(statusCode)) {
            return false;
        }
        if (statusCode && RETRYABLE_HTTP_STATUS_CODES.has(statusCode)) {
            return true;
        }
        const errorCode = axiosError?.code;
        return Boolean(errorCode && RETRYABLE_NETWORK_CODES.has(errorCode));
    }
    getRetryDelayMs(attempt) {
        const baseDelay = 200 * 2 ** (attempt - 1);
        const jitter = Math.floor(Math.random() * 100);
        return baseDelay + jitter;
    }
    toUnavailableException(normalizedSymbol, error, requestLabel = 'request') {
        const axiosError = error;
        const statusCode = axiosError?.response?.status;
        const errorCode = axiosError?.code;
        const detail = statusCode
            ? `status ${statusCode}`
            : (errorCode ?? 'unknown');
        this.logger.error(`Binance ${requestLabel} fetch failed for ${normalizedSymbol}: ${detail}`, axiosError?.stack);
        return new BinanceUnavailableException(`Binance ${requestLabel} fetch failed for ${normalizedSymbol}`);
    }
    toStringValue(value) {
        if (value === undefined || value === null) {
            return null;
        }
        return String(value);
    }
    async sleep(ms) {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }
};
exports.BinanceService = BinanceService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_MINUTE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BinanceService.prototype, "refreshTrackedSymbols", null);
exports.BinanceService = BinanceService = BinanceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
        config_1.ConfigService,
        cache_service_1.CacheService])
], BinanceService);
//# sourceMappingURL=binance.service.js.map