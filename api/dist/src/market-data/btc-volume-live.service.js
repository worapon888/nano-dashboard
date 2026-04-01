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
var BtcVolumeLiveService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BtcVolumeLiveService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ws_1 = __importDefault(require("ws"));
const events_tokens_1 = require("../events/events.tokens");
const BTC_SYMBOL = 'BTCUSDT';
const BTC_VOLUME_UPDATED_EVENT = 'btc.volume.updated';
const DEFAULT_BINANCE_WS_BASE_URL = 'wss://stream.binance.com:9443/ws';
const BTC_KLINE_STREAMS = ['15m', '1h', '4h', '1d'].map((interval) => `btcusdt@kline_${interval}`);
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;
const BULLISH_COLOR = '#22c55e';
const BEARISH_COLOR = '#ef4444';
let BtcVolumeLiveService = BtcVolumeLiveService_1 = class BtcVolumeLiveService {
    configService;
    marketEventsPublisher;
    logger = new common_1.Logger(BtcVolumeLiveService_1.name);
    socket = null;
    reconnectTimer = null;
    reconnectAttempt = 0;
    isShuttingDown = false;
    lastEventSignatureByTimeframe = new Map();
    constructor(configService, marketEventsPublisher) {
        this.configService = configService;
        this.marketEventsPublisher = marketEventsPublisher;
    }
    onModuleInit() {
        if (!this.shouldStartStream()) {
            this.logger.log('BTC live volume stream disabled');
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
        const streamUrl = this.getWsStreamUrl();
        this.logger.log(`Connecting BTC live volume stream: ${streamUrl}`);
        const socket = new ws_1.default(streamUrl);
        this.socket = socket;
        socket.on('open', () => {
            if (this.socket !== socket) {
                return;
            }
            this.reconnectAttempt = 0;
            this.logger.log('BTC live volume stream connected');
        });
        socket.on('message', (payload) => {
            void this.handleMessage(payload);
        });
        socket.on('close', (code, reason) => {
            if (this.socket !== socket) {
                return;
            }
            const reasonText = reason.toString() || 'no reason';
            this.logger.warn(`BTC live volume stream closed (code ${code}, reason ${reasonText})`);
            this.socket = null;
            if (!this.isShuttingDown) {
                this.scheduleReconnect();
            }
        });
        socket.on('error', (error) => {
            if (this.socket !== socket) {
                return;
            }
            this.logger.warn(`BTC live volume stream error: ${error.message}`, error.stack);
        });
    }
    async handleMessage(payload) {
        const parsed = this.parseMessage(payload.toString());
        if (!parsed) {
            return;
        }
        const signature = `${parsed.label}:${parsed.updatedAt}:${parsed.volume}:${parsed.direction}`;
        const lastSignature = this.lastEventSignatureByTimeframe.get(parsed.timeframe);
        if (signature === lastSignature) {
            return;
        }
        this.lastEventSignatureByTimeframe.set(parsed.timeframe, signature);
        try {
            await this.marketEventsPublisher?.publishTicker(BTC_VOLUME_UPDATED_EVENT, parsed);
        }
        catch (error) {
            this.logger.warn(`BTC live volume broadcast failed: ${error instanceof Error ? error.message : 'unknown error'}`, error instanceof Error ? error.stack : undefined);
        }
    }
    parseMessage(raw) {
        try {
            const envelope = JSON.parse(raw);
            const payload = envelope.data;
            const kline = payload?.k;
            if (payload?.s !== BTC_SYMBOL || kline?.s !== BTC_SYMBOL) {
                return null;
            }
            const timeframe = this.normalizeInterval(kline?.i);
            if (!timeframe) {
                return null;
            }
            const openTime = typeof kline.t === 'number' ? kline.t : NaN;
            const open = this.toOptionalFiniteNumber(kline.o);
            const close = this.toOptionalFiniteNumber(kline.c);
            const volume = this.toOptionalFiniteNumber(kline.v);
            if (!Number.isFinite(openTime) ||
                open === null ||
                close === null ||
                volume === null) {
                return null;
            }
            const direction = close >= open ? 'bullish' : 'bearish';
            const updatedAt = new Date(typeof payload?.E === 'number' ? payload.E : Date.now()).toISOString();
            return {
                symbol: BTC_SYMBOL,
                timeframe,
                label: this.formatVolumeLabel(openTime, timeframe),
                volume,
                color: direction === 'bullish' ? BULLISH_COLOR : BEARISH_COLOR,
                direction,
                updatedAt,
            };
        }
        catch (error) {
            this.logger.warn(`BTC live volume message parse failed: ${error instanceof Error ? error.message : 'unknown error'}`);
            return null;
        }
    }
    normalizeInterval(value) {
        return value === '15m' || value === '1h' || value === '4h' || value === '1d'
            ? value
            : null;
    }
    scheduleReconnect() {
        if (this.reconnectTimer || this.isShuttingDown) {
            return;
        }
        this.reconnectAttempt += 1;
        const delayMs = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** (this.reconnectAttempt - 1), RECONNECT_MAX_DELAY_MS);
        this.logger.warn(`Retrying BTC live volume stream connection in ${delayMs}ms (attempt ${this.reconnectAttempt})`);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, delayMs);
    }
    getWsStreamUrl() {
        const configuredBaseUrl = this.configService.get('BINANCE_WS_BASE_URL') ??
            DEFAULT_BINANCE_WS_BASE_URL;
        const normalizedBaseUrl = configuredBaseUrl.replace(/\/+$/, '');
        const baseOrigin = normalizedBaseUrl.replace(/\/ws$/, '');
        return `${baseOrigin}/stream?streams=${BTC_KLINE_STREAMS.join('/')}`;
    }
    formatVolumeLabel(timestamp, timeframe) {
        const date = new Date(timestamp);
        if (timeframe === '15m' || timeframe === '1h') {
            return new Intl.DateTimeFormat('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
                timeZone: 'UTC',
            }).format(date);
        }
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
        }).format(date);
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
exports.BtcVolumeLiveService = BtcVolumeLiveService;
exports.BtcVolumeLiveService = BtcVolumeLiveService = BtcVolumeLiveService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Optional)()),
    __param(1, (0, common_1.Inject)(events_tokens_1.MARKET_EVENTS_PUBLISHER)),
    __metadata("design:paramtypes", [config_1.ConfigService, Object])
], BtcVolumeLiveService);
//# sourceMappingURL=btc-volume-live.service.js.map