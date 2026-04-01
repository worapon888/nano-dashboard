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

@Injectable()
export class BtcPriceLiveService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BtcPriceLiveService.name);
  private socket: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempt = 0;
  private isShuttingDown = false;
  private lastEventSignature: string | null = null;

  constructor(
    private readonly configService: ConfigService,
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
    this.logger.log(`Connecting BTC live price stream: ${streamUrl}`);

    const socket = new WebSocket(streamUrl);
    this.socket = socket;

    socket.on('open', () => {
      if (this.socket !== socket) {
        return;
      }

      this.reconnectAttempt = 0;
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
    });
  }

  private async handleMessage(payload: RawData): Promise<void> {
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
      `Retrying BTC live price stream connection in ${delayMs}ms (attempt ${this.reconnectAttempt})`,
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
