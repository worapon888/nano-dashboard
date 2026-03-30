"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardSummaryDto = exports.DashboardHealthDto = exports.DashboardTopMoverDto = void 0;
class DashboardTopMoverDto {
    symbol;
    price;
    volume24h;
    priceChange24h;
    high24h;
    low24h;
    fetchedAt;
}
exports.DashboardTopMoverDto = DashboardTopMoverDto;
class DashboardHealthDto {
    db;
    redis;
    wsConnections;
}
exports.DashboardHealthDto = DashboardHealthDto;
class DashboardSummaryDto {
    userCount;
    topMovers;
    health;
    warnings;
    stale;
    generatedAt;
}
exports.DashboardSummaryDto = DashboardSummaryDto;
//# sourceMappingURL=dashboard-summary.dto.js.map