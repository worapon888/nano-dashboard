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
import { BinanceService } from '../binance/binance.service';
import { MARKET_EVENTS_PUBLISHER } from '../events/events.tokens';
import type { MarketEventsPublisher } from '../events/events.tokens';
import { BtcLiveVolumeUpdateDto } from './dto/btc-live-volume-update.dto';

type BinanceCombinedStreamPayload = {
  stream?: string;
  data?: BinanceKlineStreamPayload;
};

type BinanceKlineStreamPayload = {
  e?: string;
  E?: number;
  s?: string;
  k?: {
    t?: number;
    T?: number;
    s?: string;
    i?: string;
    o?: string;
    c?: string;
    v?: string;
  };
};

const BTC_SYMBOL = 'BTCUSDT';
const BTC_VOLUME_UPDATED_EVENT = 'btc.volume.updated';
const DEFAULT_BINANCE_WS_BASE_URL = 'wss://stream.binance.com:9443/ws';
const BTC_KLINE_STREAMS = ['15m', '1h', '4h', '1d'].map(
  (interval) => `btcusdt@kline_${interval}`,
);
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;
const BULLISH_COLOR = '#22c55e';
const BEARISH_COLOR = '#ef4444';
const FALLBACK_POLL_INTERVAL_MS = 30000;

@Injectable()
export class BtcVolumeLiveService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BtcVolumeLiveService.name);
  private socket: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private fallbackPollTimer: NodeJS.Timeout | null = null;
  private reconnectAttempt = 0;
  private isShuttingDown = false;
  private readonly lastEventSignatureByTimeframe = new Map<string, string>();
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
      this.logger.log('BTC live volume stream disabled');
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

    const streamUrl = this.getWsStreamUrl();
    this.logger.log(
      `Connecting BTC live volume stream (attempt ${this.reconnectAttempt + 1}): ${streamUrl}`,
    );

    const socket = new WebSocket(streamUrl);
    this.socket = socket;

    socket.on('open', () => {
      if (this.socket !== socket) {
        return;
      }

      this.reconnectAttempt = 0;
      this.deactivateFallback('websocket_connected');
      this.logger.log('BTC live volume stream connected');
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
        `BTC live volume stream closed (code ${code}, reason ${reasonText})`,
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
        `BTC live volume stream error: ${error.message}`,
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

  private async publishUpdate(parsed: BtcLiveVolumeUpdateDto): Promise<void> {
    const signature = `${parsed.label}:${parsed.updatedAt}:${parsed.volume}:${parsed.direction}`;
    const lastSignature = this.lastEventSignatureByTimeframe.get(parsed.timeframe);

    if (signature === lastSignature) {
      return;
    }

    this.lastEventSignatureByTimeframe.set(parsed.timeframe, signature);

    try {
      await this.marketEventsPublisher?.publishTicker(
        BTC_VOLUME_UPDATED_EVENT,
        parsed as unknown as Record<string, unknown>,
      );
    } catch (error) {
      this.logger.warn(
        `BTC live volume broadcast failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private parseMessage(raw: string): BtcLiveVolumeUpdateDto | null {
    try {
      const envelope = JSON.parse(raw) as BinanceCombinedStreamPayload;
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

      if (
        !Number.isFinite(openTime) ||
        open === null ||
        close === null ||
        volume === null
      ) {
        return null;
      }

      const direction = close >= open ? 'bullish' : 'bearish';
      const updatedAt = new Date(
        typeof payload?.E === 'number' ? payload.E : Date.now(),
      ).toISOString();

      return {
        symbol: BTC_SYMBOL,
        timeframe,
        label: this.formatVolumeLabel(openTime, timeframe),
        volume,
        color: direction === 'bullish' ? BULLISH_COLOR : BEARISH_COLOR,
        direction,
        updatedAt,
      };
    } catch (error) {
      this.logger.warn(
        `BTC live volume message parse failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return null;
    }
  }

  private normalizeInterval(value: unknown): BtcLiveVolumeUpdateDto['timeframe'] | null {
    return value === '15m' || value === '1h' || value === '4h' || value === '1d'
      ? value
      : null;
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
      `Retrying BTC live volume stream connection in ${delayMs}ms (retry ${this.reconnectAttempt}, url ${this.getResolvedStreamUrl()})`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delayMs);
  }

  private getWsStreamUrl(): string {
    const configuredBaseUrl =
      this.configService.get<string>('BINANCE_WS_BASE_URL') ??
      DEFAULT_BINANCE_WS_BASE_URL;
    const normalizedBaseUrl = configuredBaseUrl.replace(/\/+$/, '');
    const baseOrigin = normalizedBaseUrl.replace(/\/ws$/, '');

    return `${baseOrigin}/stream?streams=${BTC_KLINE_STREAMS.join('/')}`;
  }

  private getResolvedStreamUrl(): string {
    return this.getWsStreamUrl();
  }

  private activateFallback(reason: string): void {
    if (this.isShuttingDown || this.isFallbackActive) {
      return;
    }

    this.isFallbackActive = true;
    this.logger.warn(
      `BTC live volume fallback activated (${reason}); polling REST klines while websocket retries continue`,
    );
    void this.pollFallbackOnce();
  }

  private deactivateFallback(reason: string): void {
    if (!this.isFallbackActive) {
      return;
    }

    this.logger.log(`BTC live volume fallback deactivated (${reason})`);
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
      const klinesByTimeframe = await Promise.all(
        (
          ['15m', '1h', '4h', '1d'] as BtcLiveVolumeUpdateDto['timeframe'][]
        ).map(async (timeframe) => ({
          timeframe,
          klines: await this.binanceService.getKlines(BTC_SYMBOL, timeframe, 1),
        })),
      );

      for (const { timeframe, klines } of klinesByTimeframe) {
        const latestKline = klines[0];
        if (!latestKline) {
          continue;
        }

        const openTime = Number(latestKline[0]);
        const open = this.toOptionalFiniteNumber(latestKline[1]);
        const close = this.toOptionalFiniteNumber(latestKline[4]);
        const volume = this.toOptionalFiniteNumber(latestKline[5]);

        if (
          !Number.isFinite(openTime) ||
          open === null ||
          close === null ||
          volume === null
        ) {
          continue;
        }

        const direction = close >= open ? 'bullish' : 'bearish';

        await this.publishUpdate({
          symbol: BTC_SYMBOL,
          timeframe,
          label: this.formatVolumeLabel(openTime, timeframe),
          volume,
          color: direction === 'bullish' ? BULLISH_COLOR : BEARISH_COLOR,
          direction,
          updatedAt: new Date(Number(latestKline[6]) || Date.now()).toISOString(),
        });
      }
    } catch (error) {
      this.logger.warn(
        `BTC live volume fallback poll failed: ${
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

  private formatVolumeLabel(
    timestamp: number,
    timeframe: BtcLiveVolumeUpdateDto['timeframe'],
  ): string {
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
