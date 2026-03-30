import { ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { TickerDto } from '../market-data/dto/ticker.dto';
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
    private toTickerDto;
    private shouldRetry;
    private getRetryDelayMs;
    private toUnavailableException;
    private toStringValue;
    private sleep;
}
