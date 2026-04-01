import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import type { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { TickerDto } from '../market-data/dto/ticker.dto';

type BinanceTickerResponse = {
  symbol?: string;
  lastPrice?: string;
  volume?: string;
  priceChange?: string;
  priceChangePercent?: string;
  highPrice?: string;
  lowPrice?: string;
};

export type BinanceKlineInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
export type BinanceKlineResponse = [
  openTime: number,
  openPrice: string,
  highPrice: string,
  lowPrice: string,
  closePrice: string,
  volume: string,
  closeTime: number,
  quoteAssetVolume: string,
  numberOfTrades: number,
  takerBuyBaseAssetVolume: string,
  takerBuyQuoteAssetVolume: string,
  ignore: string,
];

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

export class BinanceUnavailableException extends ServiceUnavailableException {
  constructor(message = 'Binance market data is temporarily unavailable') {
    super(message);
  }
}

@Injectable()
export class BinanceService {
  private readonly baseUrl: string;
  private readonly logger = new Logger(BinanceService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    // Fail fast at startup when the upstream base URL is missing.
    this.baseUrl = this.configService.getOrThrow<string>('BINANCE_BASE_URL');
  }

  async getTicker(symbol: string): Promise<TickerDto> {
    const normalizedSymbol = symbol.toUpperCase();
    const payload = await this.requestWithRetry<BinanceTickerResponse>(
      normalizedSymbol,
      '/api/v3/ticker/24hr',
      { symbol: normalizedSymbol },
      'ticker',
    );

    return this.toTickerDto(normalizedSymbol, payload);
  }

  async getKlines(
    symbol: string,
    interval: BinanceKlineInterval,
    limit: number,
  ): Promise<BinanceKlineResponse[]> {
    const normalizedSymbol = symbol.toUpperCase();
    const safeLimit =
      Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 1;

    return this.requestWithRetry<BinanceKlineResponse[]>(
      normalizedSymbol,
      '/api/v3/klines',
      {
        symbol: normalizedSymbol,
        interval,
        limit: safeLimit,
      },
      `klines:${interval}`,
    );
  }

  private toTickerDto(
    normalizedSymbol: string,
    payload: BinanceTickerResponse,
  ): TickerDto {
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

  private async requestWithRetry<TResponse>(
    normalizedSymbol: string,
    path: string,
    params: Record<string, string | number>,
    requestLabel: string,
  ): Promise<TResponse> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= BINANCE_MAX_ATTEMPTS; attempt++) {
      try {
        const response = await firstValueFrom(
          this.httpService.get<TResponse>(`${this.baseUrl}${path}`, {
            params,
            timeout: BINANCE_REQUEST_TIMEOUT_MS,
          }),
        );

        return response.data;
      } catch (error) {
        lastError = error;

        if (!this.shouldRetry(error) || attempt === BINANCE_MAX_ATTEMPTS) {
          break;
        }

        const delayMs = this.getRetryDelayMs(attempt);
        const axiosError = error as AxiosError | undefined;
        const detail =
          axiosError?.response?.status ?? axiosError?.code ?? 'unknown';

        this.logger.warn(
          `Retrying Binance ${requestLabel} fetch for ${normalizedSymbol} (attempt ${attempt}, detail ${detail})`,
        );

        await this.sleep(delayMs);
      }
    }

    const unavailableException = this.toUnavailableException(
      normalizedSymbol,
      lastError,
      requestLabel,
    );

    throw unavailableException;
  }

  private shouldRetry(error: unknown): boolean {
    const axiosError = error as AxiosError | undefined;

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

  private getRetryDelayMs(attempt: number): number {
    const baseDelay = 200 * 2 ** (attempt - 1);
    const jitter = Math.floor(Math.random() * 100);
    return baseDelay + jitter;
  }

  private toUnavailableException(
    normalizedSymbol: string,
    error: unknown,
    requestLabel = 'request',
  ): BinanceUnavailableException {
    const axiosError = error as AxiosError | undefined;

    const statusCode = axiosError?.response?.status;
    const errorCode = axiosError?.code;

    const detail = statusCode
      ? `status ${statusCode}`
      : (errorCode ?? 'unknown');

    this.logger.error(
      `Binance ${requestLabel} fetch failed for ${normalizedSymbol}: ${detail}`,
      axiosError?.stack,
    );

    return new BinanceUnavailableException(
      `Binance ${requestLabel} fetch failed for ${normalizedSymbol}`,
    );
  }

  private toStringValue(value: string | undefined): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    return String(value);
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
