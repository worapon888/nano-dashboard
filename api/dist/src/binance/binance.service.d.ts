import { OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { TickerDto } from '../market-data/dto/ticker.dto';
import { CacheService } from '../redis/cache.service';
export type BinanceKlineInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
export type PriceData = {
    symbol: string;
    price: string;
    fetchedAt: string;
    source: 'cache' | 'rest' | 'stream' | 'fallback';
    stale?: boolean;
};
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
    ignore: string
];
export declare class BinanceUnavailableException extends ServiceUnavailableException {
    constructor(message?: string);
}
export declare class BinanceService implements OnModuleDestroy {
    private readonly httpService;
    private readonly configService;
    private readonly cacheService;
    private readonly baseUrl;
    private readonly wsBaseUrl;
    private readonly logger;
    private readonly subscriptions;
    private readonly trackedSymbols;
    constructor(httpService: HttpService, configService: ConfigService, cacheService: CacheService);
    onModuleDestroy(): Promise<void>;
    getPrice(symbol: string): Promise<PriceData>;
    subscribeRealtime(symbol: string): void;
    refreshTrackedSymbols(): Promise<void>;
    getTicker(symbol: string): Promise<TickerDto>;
    getKlines(symbol: string, interval: BinanceKlineInterval, limit: number): Promise<BinanceKlineResponse[]>;
    private connectRealtime;
    private handleRealtimeMessage;
    private scheduleReconnect;
    private getPriceCacheKey;
    private parseCachedPriceData;
    private toTickerDto;
    private requestWithRetry;
    private shouldRetry;
    private getRetryDelayMs;
    private toUnavailableException;
    private toStringValue;
    private sleep;
}
