import { ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { TickerDto } from '../market-data/dto/ticker.dto';
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
    ignore: string
];
export declare class BinanceUnavailableException extends ServiceUnavailableException {
    constructor(message?: string);
}
export declare class BinanceService {
    private readonly httpService;
    private readonly configService;
    private readonly baseUrl;
    private readonly logger;
    constructor(httpService: HttpService, configService: ConfigService);
    getTicker(symbol: string): Promise<TickerDto>;
    getKlines(symbol: string, interval: BinanceKlineInterval, limit: number): Promise<BinanceKlineResponse[]>;
    private toTickerDto;
    private requestWithRetry;
    private shouldRetry;
    private getRetryDelayMs;
    private toUnavailableException;
    private toStringValue;
    private sleep;
}
