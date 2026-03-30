export declare class DashboardTopMoverDto {
    symbol: string;
    price: string;
    volume24h: string | null;
    priceChange24h: string | null;
    high24h: string | null;
    low24h: string | null;
    fetchedAt: string;
}
export declare class DashboardHealthDto {
    db: 'up' | 'down' | 'unknown';
    redis: 'up' | 'down' | 'unknown';
    wsConnections: number | null;
}
export declare class DashboardSummaryDto {
    userCount: number | null;
    topMovers: DashboardTopMoverDto[];
    health: DashboardHealthDto;
    warnings: string[];
    stale?: boolean;
    generatedAt: string;
}
