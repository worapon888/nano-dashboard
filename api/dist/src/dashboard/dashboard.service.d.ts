import { MarketDataService } from '../market-data/market-data.service';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
export declare class DashboardService {
    private readonly usersService;
    private readonly marketDataService;
    private readonly redisService;
    constructor(usersService: UsersService, marketDataService: MarketDataService, redisService: RedisService);
    getSummary(userId: string): Promise<{
        user: import("../users/dto/user-response.dto").UserResponseDto;
        watchlist: string[];
        market: {
            primaryTicker: import("../market-data/dto/ticker.dto").TickerDto;
        };
        generatedAt: string;
    }>;
}
