import { BinanceService } from '../binance/binance.service';
import { CacheService } from '../cache/cache.service';
import { TickerDto } from './dto/ticker.dto';
type TickerBroadcastGateway = {
    broadcastTicker?(room: string, ticker: TickerDto): Promise<void> | void;
};
export declare class MarketDataService {
    private readonly binanceService;
    private readonly cacheService;
    private readonly tickerGateway?;
    private readonly logger;
    constructor(binanceService: BinanceService, cacheService: CacheService, tickerGateway?: TickerBroadcastGateway | undefined);
    getTicker(symbol: string): Promise<TickerDto>;
    private fetchAndCacheTicker;
    private waitForFetcherOrFallback;
    private getStaleTickerOrThrow;
    private getTickerFromBinanceOrFallback;
    private broadcastFetcherUpdate;
    private publishTickerUpdate;
    private writeTickerCaches;
    private backfillStaleCacheIfMissing;
    private isBinanceUnavailableError;
    private withCacheSource;
    private stripRuntimeCacheFlags;
    private isStaleTicker;
    private normalizeSymbol;
    private getHotCacheKey;
    private getStaleCacheKey;
    private getLockKey;
    private getChannelKey;
}
export {};
