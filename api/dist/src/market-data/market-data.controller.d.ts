import { MarketDataService } from './market-data.service';
export declare class MarketDataController {
    private readonly marketDataService;
    constructor(marketDataService: MarketDataService);
    getTicker(symbol: string): Promise<{
        meta?: Record<string, any> | undefined;
        success: boolean;
        message: string;
        data: import("./dto/ticker.dto").TickerDto;
    }>;
}
