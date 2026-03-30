import { TickerDto } from './dto/ticker.dto';
import { MarketDataService } from './market-data.service';
export declare class MarketDataController {
    private readonly marketDataService;
    constructor(marketDataService: MarketDataService);
    getTicker(symbol: string): Promise<TickerDto>;
}
