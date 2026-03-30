import { DashboardService } from './dashboard.service';
export declare class DashboardController {
    private readonly dashboardService;
    constructor(dashboardService: DashboardService);
    getSummary(userId?: string): Promise<{
        user: import("../users/dto/user-response.dto").UserResponseDto;
        watchlist: string[];
        market: {
            primaryTicker: import("../market-data/dto/ticker.dto").TickerDto;
        };
        generatedAt: string;
    }>;
}
