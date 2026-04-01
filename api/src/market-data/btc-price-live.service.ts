import {
  BinanceService,
} from '../binance/binance.service';
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import WebSocket, { RawData } from 'ws';
import { MARKET_EVENTS_PUBLISHER } from '../events/events.tokens';
import type { MarketEventsPublisher } from '../events/events.tokens';
import { BtcLivePriceUpdateDto } from './dto/btc-live-price-update.dto';

type BinanceTickerStreamPayload = {
  e?: string;
  E?: number;
  s?: string;
  c?: string;
  p?: string;
  P?: string;
  h?: string;
  l?: string;
};

const BTC_SYMBOL = 'BTCUSDT';
const BTC_PRICE_UPDATED_EVENT = 'btc.price.updated';
const DEFAULT_BINANCE_WS_BASE_URL = 'wss://stream.binance.com:9443/ws';
const BTC_BINANCE_STREAM = 'btcusdt@ticker';
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;
const FALLBACK_POLL_INTERVAL_MS = 10000;

@Injectable()
export class BtcPriceLiveService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BtcPriceLiveService.name);
  private socket: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private fallbackPollTimer: NodeJS.Timeout | null = null;
  private reconnectAttempt = 0;
  private isShuttingDown = false;
  private lastEventSignature: string | null = null;
  private isFallbackActive = false;
  private isPollingFallback = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly binanceService: BinanceService,
    @Optional()
    @Inject(MARKET_EVENTS_PUBLISHER)
    private readonly marketEventsPublisher?: MarketEventsPublisher,
  ) {}

  onModuleInit(): void {
    if (!this.shouldStartStream()) {
      this.logger.log('BTC live price stream disabled');
      return;
    }

    this.connect();
  }

  onModuleDestroy(): void {
    this.isShuttingDown = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopFallbackPolling();

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.close();
      this.socket = null;
    }
  }

  private shouldStartStream(): boolean {
    if (process.env.NODE_ENV === 'test') {
      return false;
    }

    if (this.configService.get<string>('BINANCE_LIVE_STREAM_ENABLED') === 'false') {
      return false;
    }

    return Boolean(this.marketEventsPublisher?.publishTicker);
  }

  private connect(): void {
    if (this.isShuttingDown || this.socket) {
      return;
    }

    const streamUrl = `${this.getWsBaseUrl()}/${BTC_BINANCE_STREAM}`;
    this.logger.log(
      `Connecting BTC live price stream (attempt ${this.reconnectAttempt + 1}): ${streamUrl}`,
    );

    const socket = new WebSocket(streamUrl);
    this.socket = socket;

    socket.on('open', () => {
      if (this.socket !== socket) {
        return;
      }

      this.reconnectAttempt = 0;
      this.deactivateFallback('websocket_connected');
      this.logger.log('BTC live price stream connected');
    });

    socket.on('message', (payload: RawData) => {
      void this.handleMessage(payload);
    });

    socket.on('close', (code, reason) => {
      if (this.socket !== socket) {
        return;
      }

      const reasonText = reason.toString() || 'no reason';
      this.logger.warn(
        `BTC live price stream closed (code ${code}, reason ${reasonText})`,
      );
      this.socket = null;
      this.activateFallback(`socket_close_${code}`);

      if (!this.isShuttingDown) {
        this.scheduleReconnect();
      }
    });

    socket.on('error', (error) => {
      if (this.socket !== socket) {
        return;
      }

      this.logger.warn(
        `BTC live price stream error: ${error.message}`,
        error.stack,
      );
      this.activateFallback(this.classifyFallbackReason(error));
    });
  }

  private async handleMessage(payload: RawData): Promise<void> {
    const parsed = this.parseMessage(payload.toString());

    if (!parsed) {
      return;
    }

    await this.publishUpdate(parsed);
  }

  private async publishUpdate(parsed: BtcLivePriceUpdateDto): Promise<void> {
    const signature = `${parsed.updatedAt}:${parsed.price}:${parsed.change24h ?? ''}:${parsed.change24hPercent ?? ''}`;

    if (signature === this.lastEventSignature) {
      return;
    }

    this.lastEventSignature = signature;

    try {
      await this.marketEventsPublisher?.publishTicker(
        BTC_PRICE_UPDATED_EVENT,
        parsed as unknown as Record<string, unknown>,
      );
    } catch (error) {
      this.logger.warn(
        `BTC live price broadcast failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private parseMessage(raw: string): BtcLivePriceUpdateDto | null {
    try {
      const payload = JSON.parse(raw) as BinanceTickerStreamPayload;

      if (payload.s !== BTC_SYMBOL) {
        return null;
      }

      const price = this.toOptionalFiniteNumber(payload.c);
      if (price === null) {
        return null;
      }

      const updatedAt = new Date(
        typeof payload.E === 'number' ? payload.E : Date.now(),
      ).toISOString();

      return {
        symbol: BTC_SYMBOL,
        price,
        ...(this.toOptionalFiniteNumber(payload.p) !== null
          ? { change24h: this.toOptionalFiniteNumber(payload.p) ?? undefined }
          : {}),
        ...(this.toOptionalFiniteNumber(payload.P) !== null
          ? {
              change24hPercent:
                this.toOptionalFiniteNumber(payload.P) ?? undefined,
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
    } catch (error) {
      this.logger.warn(
        `BTC live price message parse failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.isShuttingDown) {
      return;
    }

    this.reconnectAttempt += 1;
    const delayMs = Math.min(
      RECONNECT_BASE_DELAY_MS * 2 ** (this.reconnectAttempt - 1),
      RECONNECT_MAX_DELAY_MS,
    );

    this.logger.warn(
      `Retrying BTC live price stream connection in ${delayMs}ms (retry ${this.reconnectAttempt}, url ${this.getResolvedStreamUrl()})`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delayMs);
  }

  private getWsBaseUrl(): string {
    const configuredBaseUrl =
      this.configService.get<string>('BINANCE_WS_BASE_URL') ??
      DEFAULT_BINANCE_WS_BASE_URL;

    return configuredBaseUrl.replace(/\/+$/, '');
  }

  private getResolvedStreamUrl(): string {
    return `${this.getWsBaseUrl()}/${BTC_BINANCE_STREAM}`;
  }

  private activateFallback(reason: string): void {
    if (this.isShuttingDown || this.isFallbackActive) {
      return;
    }

    this.isFallbackActive = true;
    this.logger.warn(
      `BTC live price fallback activated (${reason}); polling REST ticker while websocket retries continue`,
    );
    void this.pollFallbackOnce();
  }

  private deactivateFallback(reason: string): void {
    if (!this.isFallbackActive) {
      return;
    }

    this.logger.log(`BTC live price fallback deactivated (${reason})`);
    this.isFallbackActive = false;
    this.stopFallbackPolling();
  }

  private stopFallbackPolling(): void {
    if (this.fallbackPollTimer) {
      clearTimeout(this.fallbackPollTimer);
      this.fallbackPollTimer = null;
    }

    this.isPollingFallback = false;
  }

  private async pollFallbackOnce(): Promise<void> {
    if (
      this.isShuttingDown ||
      !this.isFallbackActive ||
      this.isPollingFallback
    ) {
      return;
    }

    this.isPollingFallback = true;

    try {
      const ticker = await this.binanceService.getTicker(BTC_SYMBOL);
      const price = this.toOptionalFiniteNumber(ticker.price);

      if (price !== null) {
        const payload: BtcLivePriceUpdateDto = {
          symbol: BTC_SYMBOL,
          price,
          ...(this.toOptionalFiniteNumber(ticker.priceChange24h) !== null
            ? {
                change24h:
                  this.toOptionalFiniteNumber(ticker.priceChange24h) ??
                  undefined,
              }
            : {}),
          ...(this.toOptionalFiniteNumber(ticker.priceChange24hPercent) !== null
            ? {
                change24hPercent:
                  this.toOptionalFiniteNumber(ticker.priceChange24hPercent) ??
                  undefined,
              }
            : {}),
          ...(this.toOptionalFiniteNumber(ticker.high24h) !== null
            ? {
                high24h:
                  this.toOptionalFiniteNumber(ticker.high24h) ?? undefined,
              }
            : {}),
          ...(this.toOptionalFiniteNumber(ticker.low24h) !== null
            ? {
                low24h: this.toOptionalFiniteNumber(ticker.low24h) ?? undefined,
              }
            : {}),
          updatedAt:
            typeof ticker.fetchedAt === 'string' && ticker.fetchedAt.length > 0
              ? ticker.fetchedAt
              : new Date().toISOString(),
        };

        await this.publishUpdate(payload);
      }
    } catch (error) {
      this.logger.warn(
        `BTC live price fallback poll failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.isPollingFallback = false;

      if (!this.isShuttingDown && this.isFallbackActive) {
        this.fallbackPollTimer = setTimeout(() => {
          this.fallbackPollTimer = null;
          void this.pollFallbackOnce();
        }, FALLBACK_POLL_INTERVAL_MS);
      }
    }
  }

  private classifyFallbackReason(error: Error): string {
    return /451/.test(error.message) ? 'upstream_http_451' : 'websocket_error';
  }

  private toOptionalFiniteNumber(value: unknown): number | null {
    const parsed =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number(value)
          : NaN;

    return Number.isFinite(parsed) ? parsed : null;
  }
}
