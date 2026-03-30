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
  priceChangePercent?: string;
  highPrice?: string;
  lowPrice?: string;
};

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
    let lastError: unknown;

    for (let attempt = 1; attempt <= BINANCE_MAX_ATTEMPTS; attempt++) {
      try {
        const response = await firstValueFrom(
          this.httpService.get<BinanceTickerResponse>(
            `${this.baseUrl}/api/v3/ticker/24hr`,
            {
              params: { symbol: normalizedSymbol },
              timeout: BINANCE_REQUEST_TIMEOUT_MS,
            },
          ),
        );

        return this.toTickerDto(normalizedSymbol, response.data);
      } catch (error) {
        lastError = error;

        if (!this.shouldRetry(error) || attempt === BINANCE_MAX_ATTEMPTS) {
          break;
        }

        const delayMs = this.getRetryDelayMs(attempt);

        this.logger.warn(
          `Retrying Binance ticker fetch for ${normalizedSymbol} (attempt ${attempt})`,
        );

        await this.sleep(delayMs);
      }
    }

    throw this.toUnavailableException(normalizedSymbol, lastError);
  }

  private toTickerDto(
    normalizedSymbol: string,
    payload: BinanceTickerResponse,
  ): TickerDto {
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
  ): BinanceUnavailableException {
    const axiosError = error as AxiosError | undefined;

    const statusCode = axiosError?.response?.status;
    const errorCode = axiosError?.code;

    const detail = statusCode
      ? `status ${statusCode}`
      : (errorCode ?? 'unknown');

    this.logger.error(
      `Binance ticker fetch failed for ${normalizedSymbol}: ${detail}`,
      axiosError?.stack,
    );

    return new BinanceUnavailableException(
      `Binance ticker fetch failed for ${normalizedSymbol}`,
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
