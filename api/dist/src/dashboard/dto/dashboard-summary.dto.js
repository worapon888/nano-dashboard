"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardSummaryDto = exports.DashboardOpenOrdersDto = exports.DashboardOpenOrderItemDto = exports.DashboardDailyPnlDto = exports.DashboardDailyPnlStatsDto = exports.DashboardDailyPnlPointDto = exports.DashboardVolumeProfileDto = exports.DashboardBtcPriceTrendDto = exports.MarketShareItemDto = exports.DashboardMarketOverviewDto = exports.DashboardHealthDto = exports.DashboardTopMoverDto = void 0;
const swagger_1 = require("@nestjs/swagger");
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
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'BTCUSDT' }),
    __metadata("design:type", String)
], DashboardTopMoverDto.prototype, "symbol", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '68432.10' }),
    __metadata("design:type", String)
], DashboardTopMoverDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '23100.50', nullable: true }),
    __metadata("design:type", Object)
], DashboardTopMoverDto.prototype, "volume24h", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '1780.00', nullable: true }),
    __metadata("design:type", Object)
], DashboardTopMoverDto.prototype, "priceChange24h", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '69310.00', nullable: true }),
    __metadata("design:type", Object)
], DashboardTopMoverDto.prototype, "high24h", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '66427.53', nullable: true }),
    __metadata("design:type", Object)
], DashboardTopMoverDto.prototype, "low24h", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-01T10:00:30.000Z' }),
    __metadata("design:type", String)
], DashboardTopMoverDto.prototype, "fetchedAt", void 0);
class DashboardHealthDto {
    db;
    redis;
    wsConnections;
}
exports.DashboardHealthDto = DashboardHealthDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['up', 'down', 'unknown'], example: 'up' }),
    __metadata("design:type", String)
], DashboardHealthDto.prototype, "db", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['up', 'down', 'unknown'], example: 'up' }),
    __metadata("design:type", String)
], DashboardHealthDto.prototype, "redis", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3, nullable: true }),
    __metadata("design:type", Object)
], DashboardHealthDto.prototype, "wsConnections", void 0);
class DashboardMarketOverviewDto {
    btcDominance;
    fearGreedIndex;
}
exports.DashboardMarketOverviewDto = DashboardMarketOverviewDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 52.31 }),
    __metadata("design:type", Number)
], DashboardMarketOverviewDto.prototype, "btcDominance", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 86 }),
    __metadata("design:type", Number)
], DashboardMarketOverviewDto.prototype, "fearGreedIndex", void 0);
class MarketShareItemDto {
    symbol;
    dominance;
}
exports.MarketShareItemDto = MarketShareItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'BTC' }),
    __metadata("design:type", String)
], MarketShareItemDto.prototype, "symbol", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 52.31 }),
    __metadata("design:type", Number)
], MarketShareItemDto.prototype, "dominance", void 0);
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
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['15m', '1h', '4h', '1d'], example: '1h' }),
    __metadata("design:type", String)
], DashboardBtcPriceTrendDto.prototype, "range", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'USD' }),
    __metadata("design:type", String)
], DashboardBtcPriceTrendDto.prototype, "currency", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 68556 }),
    __metadata("design:type", Number)
], DashboardBtcPriceTrendDto.prototype, "livePrice", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1748 }),
    __metadata("design:type", Number)
], DashboardBtcPriceTrendDto.prototype, "change24h", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2.62 }),
    __metadata("design:type", Number)
], DashboardBtcPriceTrendDto.prototype, "change24hPercent", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: ['10:00', '11:00', '12:00'] }),
    __metadata("design:type", Array)
], DashboardBtcPriceTrendDto.prototype, "labels", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: [68100, 68320, 68556] }),
    __metadata("design:type", Array)
], DashboardBtcPriceTrendDto.prototype, "series", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 69310 }),
    __metadata("design:type", Number)
], DashboardBtcPriceTrendDto.prototype, "high", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 66427.53 }),
    __metadata("design:type", Number)
], DashboardBtcPriceTrendDto.prototype, "low", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-01T10:00:30.000Z' }),
    __metadata("design:type", String)
], DashboardBtcPriceTrendDto.prototype, "updatedAt", void 0);
class DashboardVolumeProfileDto {
    timeframe;
    labels;
    volume;
    colors;
    updatedAt;
}
exports.DashboardVolumeProfileDto = DashboardVolumeProfileDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['15m', '1h', '4h', '1d'], example: '1h' }),
    __metadata("design:type", String)
], DashboardVolumeProfileDto.prototype, "timeframe", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: ['09:00', '10:00', '11:00'] }),
    __metadata("design:type", Array)
], DashboardVolumeProfileDto.prototype, "labels", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: [12000, 18000, 25582] }),
    __metadata("design:type", Array)
], DashboardVolumeProfileDto.prototype, "volume", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: ['#00E6A7', '#0EA5E9', '#FACC15'] }),
    __metadata("design:type", Array)
], DashboardVolumeProfileDto.prototype, "colors", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-01T10:00:30.000Z' }),
    __metadata("design:type", String)
], DashboardVolumeProfileDto.prototype, "updatedAt", void 0);
class DashboardDailyPnlPointDto {
    day;
    value;
}
exports.DashboardDailyPnlPointDto = DashboardDailyPnlPointDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Mon' }),
    __metadata("design:type", String)
], DashboardDailyPnlPointDto.prototype, "day", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 480 }),
    __metadata("design:type", Number)
], DashboardDailyPnlPointDto.prototype, "value", void 0);
class DashboardDailyPnlStatsDto {
    best;
    worst;
    avg;
    win;
    loss;
}
exports.DashboardDailyPnlStatsDto = DashboardDailyPnlStatsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 820 }),
    __metadata("design:type", Number)
], DashboardDailyPnlStatsDto.prototype, "best", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: -140 }),
    __metadata("design:type", Number)
], DashboardDailyPnlStatsDto.prototype, "worst", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 255 }),
    __metadata("design:type", Number)
], DashboardDailyPnlStatsDto.prototype, "avg", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 5 }),
    __metadata("design:type", Number)
], DashboardDailyPnlStatsDto.prototype, "win", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2 }),
    __metadata("design:type", Number)
], DashboardDailyPnlStatsDto.prototype, "loss", void 0);
class DashboardDailyPnlDto {
    range;
    weeklyNet;
    series;
    stats;
    updatedAt;
}
exports.DashboardDailyPnlDto = DashboardDailyPnlDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['week', 'month', 'year'], example: 'week' }),
    __metadata("design:type", String)
], DashboardDailyPnlDto.prototype, "range", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1780 }),
    __metadata("design:type", Number)
], DashboardDailyPnlDto.prototype, "weeklyNet", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: () => [DashboardDailyPnlPointDto] }),
    __metadata("design:type", Array)
], DashboardDailyPnlDto.prototype, "series", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: () => DashboardDailyPnlStatsDto }),
    __metadata("design:type", DashboardDailyPnlStatsDto)
], DashboardDailyPnlDto.prototype, "stats", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-01T10:00:30.000Z' }),
    __metadata("design:type", String)
], DashboardDailyPnlDto.prototype, "updatedAt", void 0);
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
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ord_001' }),
    __metadata("design:type", String)
], DashboardOpenOrderItemDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'BTC/USDT' }),
    __metadata("design:type", String)
], DashboardOpenOrderItemDto.prototype, "pair", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['BUY', 'SELL'], example: 'BUY' }),
    __metadata("design:type", String)
], DashboardOpenOrderItemDto.prototype, "side", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['Limit', 'Market', 'Stop', 'TP'], example: 'Limit' }),
    __metadata("design:type", String)
], DashboardOpenOrderItemDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 68250 }),
    __metadata("design:type", Number)
], DashboardOpenOrderItemDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0.45 }),
    __metadata("design:type", Number)
], DashboardOpenOrderItemDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 62 }),
    __metadata("design:type", Number)
], DashboardOpenOrderItemDto.prototype, "filledPercent", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 30712.5 }),
    __metadata("design:type", Number)
], DashboardOpenOrderItemDto.prototype, "totalUsd", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['Open', 'Partial', 'Filled', 'Cancelled'], example: 'Partial' }),
    __metadata("design:type", String)
], DashboardOpenOrderItemDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Apr 1, 10:00' }),
    __metadata("design:type", String)
], DashboardOpenOrderItemDto.prototype, "createdAtLabel", void 0);
class DashboardOpenOrdersDto {
    activeCount;
    totalCount;
    items;
    updatedAt;
}
exports.DashboardOpenOrdersDto = DashboardOpenOrdersDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3 }),
    __metadata("design:type", Number)
], DashboardOpenOrdersDto.prototype, "activeCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 5 }),
    __metadata("design:type", Number)
], DashboardOpenOrdersDto.prototype, "totalCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: () => [DashboardOpenOrderItemDto] }),
    __metadata("design:type", Array)
], DashboardOpenOrdersDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-01T10:00:30.000Z' }),
    __metadata("design:type", String)
], DashboardOpenOrdersDto.prototype, "updatedAt", void 0);
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
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2, nullable: true }),
    __metadata("design:type", Object)
], DashboardSummaryDto.prototype, "userCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: () => [DashboardTopMoverDto] }),
    __metadata("design:type", Array)
], DashboardSummaryDto.prototype, "topMovers", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: () => DashboardMarketOverviewDto }),
    __metadata("design:type", DashboardMarketOverviewDto)
], DashboardSummaryDto.prototype, "marketOverview", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: () => [MarketShareItemDto] }),
    __metadata("design:type", Array)
], DashboardSummaryDto.prototype, "marketShare", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: () => DashboardBtcPriceTrendDto }),
    __metadata("design:type", DashboardBtcPriceTrendDto)
], DashboardSummaryDto.prototype, "btcPriceTrend", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: () => DashboardVolumeProfileDto }),
    __metadata("design:type", DashboardVolumeProfileDto)
], DashboardSummaryDto.prototype, "volumeProfile", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: () => DashboardDailyPnlDto }),
    __metadata("design:type", DashboardDailyPnlDto)
], DashboardSummaryDto.prototype, "dailyPnl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: () => DashboardOpenOrdersDto }),
    __metadata("design:type", DashboardOpenOrdersDto)
], DashboardSummaryDto.prototype, "openOrders", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: () => DashboardHealthDto }),
    __metadata("design:type", DashboardHealthDto)
], DashboardSummaryDto.prototype, "health", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: ['market_data_unavailable'] }),
    __metadata("design:type", Array)
], DashboardSummaryDto.prototype, "warnings", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: false }),
    __metadata("design:type", Boolean)
], DashboardSummaryDto.prototype, "stale", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-01T10:00:30.000Z' }),
    __metadata("design:type", String)
], DashboardSummaryDto.prototype, "generatedAt", void 0);
//# sourceMappingURL=dashboard-summary.dto.js.map