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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var BtcPriceLiveService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BtcPriceLiveService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ws_1 = __importDefault(require("ws"));
const events_tokens_1 = require("../events/events.tokens");
const BTC_SYMBOL = 'BTCUSDT';
const BTC_PRICE_UPDATED_EVENT = 'btc.price.updated';
const DEFAULT_BINANCE_WS_BASE_URL = 'wss://stream.binance.com:9443/ws';
const BTC_BINANCE_STREAM = 'btcusdt@ticker';
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;
let BtcPriceLiveService = BtcPriceLiveService_1 = class BtcPriceLiveService {
    configService;
    marketEventsPublisher;
    logger = new common_1.Logger(BtcPriceLiveService_1.name);
    socket = null;
    reconnectTimer = null;
    reconnectAttempt = 0;
    isShuttingDown = false;
    lastEventSignature = null;
    constructor(configService, marketEventsPublisher) {
        this.configService = configService;
        this.marketEventsPublisher = marketEventsPublisher;
    }
    onModuleInit() {
        if (!this.shouldStartStream()) {
            this.logger.log('BTC live price stream disabled');
            return;
        }
        this.connect();
    }
    onModuleDestroy() {
        this.isShuttingDown = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.close();
            this.socket = null;
        }
    }
    shouldStartStream() {
        if (process.env.NODE_ENV === 'test') {
            return false;
        }
        if (this.configService.get('BINANCE_LIVE_STREAM_ENABLED') === 'false') {
            return false;
        }
        return Boolean(this.marketEventsPublisher?.publishTicker);
    }
    connect() {
        if (this.isShuttingDown || this.socket) {
            return;
        }
        const streamUrl = `${this.getWsBaseUrl()}/${BTC_BINANCE_STREAM}`;
        this.logger.log(`Connecting BTC live price stream: ${streamUrl}`);
        const socket = new ws_1.default(streamUrl);
        this.socket = socket;
        socket.on('open', () => {
            if (this.socket !== socket) {
                return;
            }
            this.reconnectAttempt = 0;
            this.logger.log('BTC live price stream connected');
        });
        socket.on('message', (payload) => {
            void this.handleMessage(payload);
        });
        socket.on('close', (code, reason) => {
            if (this.socket !== socket) {
                return;
            }
            const reasonText = reason.toString() || 'no reason';
            this.logger.warn(`BTC live price stream closed (code ${code}, reason ${reasonText})`);
            this.socket = null;
            if (!this.isShuttingDown) {
                this.scheduleReconnect();
            }
        });
        socket.on('error', (error) => {
            if (this.socket !== socket) {
                return;
            }
            this.logger.warn(`BTC live price stream error: ${error.message}`, error.stack);
        });
    }
    async handleMessage(payload) {
        const parsed = this.parseMessage(payload.toString());
        if (!parsed) {
            return;
        }
        const signature = `${parsed.updatedAt}:${parsed.price}:${parsed.change24h ?? ''}:${parsed.change24hPercent ?? ''}`;
        if (signature === this.lastEventSignature) {
            return;
        }
        this.lastEventSignature = signature;
        try {
            await this.marketEventsPublisher?.publishTicker(BTC_PRICE_UPDATED_EVENT, parsed);
        }
        catch (error) {
            this.logger.warn(`BTC live price broadcast failed: ${error instanceof Error ? error.message : 'unknown error'}`, error instanceof Error ? error.stack : undefined);
        }
    }
    parseMessage(raw) {
        try {
            const payload = JSON.parse(raw);
            if (payload.s !== BTC_SYMBOL) {
                return null;
            }
            const price = this.toOptionalFiniteNumber(payload.c);
            if (price === null) {
                return null;
            }
            const updatedAt = new Date(typeof payload.E === 'number' ? payload.E : Date.now()).toISOString();
            return {
                symbol: BTC_SYMBOL,
                price,
                ...(this.toOptionalFiniteNumber(payload.p) !== null
                    ? { change24h: this.toOptionalFiniteNumber(payload.p) ?? undefined }
                    : {}),
                ...(this.toOptionalFiniteNumber(payload.P) !== null
                    ? {
                        change24hPercent: this.toOptionalFiniteNumber(payload.P) ?? undefined,
                    }
                    : {}),
                ...(this.toOptionalFiniteNumber(payload.h) !== null
                    ? { high24h: this.toOptionalFiniteNumber(payload.h) ?? undefined }
                    : {}),
                ...(this.toOptionalFiniteNumber(payload.l) !== null
                    ? { low24h: this.toOptionalFiniteNumber(payload.l) ?? undefined }
                    : {}),
                updatedAt,
            };
        }
        catch (error) {
            this.logger.warn(`BTC live price message parse failed: ${error instanceof Error ? error.message : 'unknown error'}`);
            return null;
        }
    }
    scheduleReconnect() {
        if (this.reconnectTimer || this.isShuttingDown) {
            return;
        }
        this.reconnectAttempt += 1;
        const delayMs = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** (this.reconnectAttempt - 1), RECONNECT_MAX_DELAY_MS);
        this.logger.warn(`Retrying BTC live price stream connection in ${delayMs}ms (attempt ${this.reconnectAttempt})`);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, delayMs);
    }
    getWsBaseUrl() {
        const configuredBaseUrl = this.configService.get('BINANCE_WS_BASE_URL') ??
            DEFAULT_BINANCE_WS_BASE_URL;
        return configuredBaseUrl.replace(/\/+$/, '');
    }
    toOptionalFiniteNumber(value) {
        const parsed = typeof value === 'number'
            ? value
            : typeof value === 'string'
                ? Number(value)
                : NaN;
        return Number.isFinite(parsed) ? parsed : null;
    }
};
exports.BtcPriceLiveService = BtcPriceLiveService;
exports.BtcPriceLiveService = BtcPriceLiveService = BtcPriceLiveService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Optional)()),
    __param(1, (0, common_1.Inject)(events_tokens_1.MARKET_EVENTS_PUBLISHER)),
    __metadata("design:paramtypes", [config_1.ConfigService, Object])
], BtcPriceLiveService);
//# sourceMappingURL=btc-price-live.service.js.map