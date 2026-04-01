"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardSummaryDto = exports.DashboardOpenOrdersDto = exports.DashboardOpenOrderItemDto = exports.DashboardDailyPnlDto = exports.DashboardDailyPnlStatsDto = exports.DashboardDailyPnlPointDto = exports.DashboardVolumeProfileDto = exports.DashboardBtcPriceTrendDto = exports.MarketShareItemDto = exports.DashboardMarketOverviewDto = exports.DashboardHealthDto = exports.DashboardTopMoverDto = void 0;
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
class DashboardMarketOverviewDto {
    btcDominance;
    fearGreedIndex;
}
exports.DashboardMarketOverviewDto = DashboardMarketOverviewDto;
class MarketShareItemDto {
    symbol;
    dominance;
}
exports.MarketShareItemDto = MarketShareItemDto;
class DashboardBtcPriceTrendDto {
    range;
    currency;
    livePrice;
    change24h;
    change24hPercent;
    labels;
    series;
    high;
    low;
    updatedAt;
}
exports.DashboardBtcPriceTrendDto = DashboardBtcPriceTrendDto;
class DashboardVolumeProfileDto {
    timeframe;
    labels;
    volume;
    colors;
    updatedAt;
}
exports.DashboardVolumeProfileDto = DashboardVolumeProfileDto;
class DashboardDailyPnlPointDto {
    day;
    value;
}
exports.DashboardDailyPnlPointDto = DashboardDailyPnlPointDto;
class DashboardDailyPnlStatsDto {
    best;
    worst;
    avg;
    win;
    loss;
}
exports.DashboardDailyPnlStatsDto = DashboardDailyPnlStatsDto;
class DashboardDailyPnlDto {
    range;
    weeklyNet;
    series;
    stats;
    updatedAt;
}
exports.DashboardDailyPnlDto = DashboardDailyPnlDto;
class DashboardOpenOrderItemDto {
    id;
    pair;
    side;
    type;
    price;
    amount;
    filledPercent;
    totalUsd;
    status;
    createdAtLabel;
}
exports.DashboardOpenOrderItemDto = DashboardOpenOrderItemDto;
class DashboardOpenOrdersDto {
    activeCount;
    totalCount;
    items;
    updatedAt;
}
exports.DashboardOpenOrdersDto = DashboardOpenOrdersDto;
class DashboardSummaryDto {
    userCount;
    topMovers;
    marketOverview;
    marketShare;
    btcPriceTrend;
    volumeProfile;
    dailyPnl;
    openOrders;
    health;
    warnings;
    stale;
    generatedAt;
}
exports.DashboardSummaryDto = DashboardSummaryDto;
//# sourceMappingURL=dashboard-summary.dto.js.map