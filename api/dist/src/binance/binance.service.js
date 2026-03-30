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
var BinanceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BinanceService = exports.BinanceUnavailableException = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const rxjs_1 = require("rxjs");
const BINANCE_REQUEST_TIMEOUT_MS = 5000;
const BINANCE_MAX_ATTEMPTS = 4;
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
    baseUrl;
    logger = new common_1.Logger(BinanceService_1.name);
    constructor(httpService, configService) {
        this.httpService = httpService;
        this.configService = configService;
        this.baseUrl = this.configService.getOrThrow('BINANCE_BASE_URL');
    }
    async getTicker(symbol) {
        const normalizedSymbol = symbol.toUpperCase();
        let lastError;
        for (let attempt = 1; attempt <= BINANCE_MAX_ATTEMPTS; attempt++) {
            try {
                const response = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.baseUrl}/api/v3/ticker/24hr`, {
                    params: { symbol: normalizedSymbol },
                    timeout: BINANCE_REQUEST_TIMEOUT_MS,
                }));
                return this.toTickerDto(normalizedSymbol, response.data);
            }
            catch (error) {
                lastError = error;
                if (!this.shouldRetry(error) || attempt === BINANCE_MAX_ATTEMPTS) {
                    break;
                }
                const delayMs = this.getRetryDelayMs(attempt);
                this.logger.warn(`Retrying Binance ticker fetch for ${normalizedSymbol} (attempt ${attempt})`);
                await this.sleep(delayMs);
            }
        }
        throw this.toUnavailableException(normalizedSymbol, lastError);
    }
    toTickerDto(normalizedSymbol, payload) {
        return {
            symbol: normalizedSymbol,
            price: this.toStringValue(payload.lastPrice) ?? '0',
            volume24h: this.toStringValue(payload.volume),
            priceChange24h: this.toStringValue(payload.priceChangePercent),
            high24h: this.toStringValue(payload.highPrice),
            low24h: this.toStringValue(payload.lowPrice),
            fetchedAt: new Date().toISOString(),
            source: 'binance',
        };
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
    toUnavailableException(normalizedSymbol, error) {
        const axiosError = error;
        const statusCode = axiosError?.response?.status;
        const errorCode = axiosError?.code;
        const detail = statusCode
            ? `status ${statusCode}`
            : (errorCode ?? 'unknown');
        this.logger.error(`Binance ticker fetch failed for ${normalizedSymbol}: ${detail}`, axiosError?.stack);
        return new BinanceUnavailableException(`Binance ticker fetch failed for ${normalizedSymbol}`);
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
exports.BinanceService = BinanceService = BinanceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
        config_1.ConfigService])
], BinanceService);
//# sourceMappingURL=binance.service.js.map