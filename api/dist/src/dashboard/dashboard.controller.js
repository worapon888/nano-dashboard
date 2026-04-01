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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const error_response_dto_1 = require("../common/dto/error-response.dto");
const api_response_util_1 = require("../common/utils/api-response.util");
const dashboard_service_1 = require("./dashboard.service");
let DashboardController = class DashboardController {
    dashboardService;
    constructor(dashboardService) {
        this.dashboardService = dashboardService;
    }
    async getDashboard() {
        return this.dashboardService.getAggregatedDashboard();
    }
    async getSummary(req, range, volumeTf, pnlRange) {
        const summary = await this.dashboardService.getSummary(req.user.sub, range, volumeTf, pnlRange);
        return (0, api_response_util_1.successResponse)(summary, 'Dashboard summary retrieved successfully');
    }
};
exports.DashboardController = DashboardController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get aggregated dashboard data for users and cached market prices' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Aggregated dashboard retrieved successfully',
        schema: {
            example: {
                users: {
                    total: 2,
                    active: 2,
                    list: [
                        {
                            id: 'c0a8012e-d8b9-4fcf-9f75-2b0d44cc0f31',
                            email: 'user@example.com',
                            displayName: 'Demo User',
                            role: 'USER',
                            isActive: true,
                            createdAt: '2026-04-01T10:00:00.000Z',
                            updatedAt: '2026-04-01T10:10:00.000Z',
                        },
                    ],
                },
                market: {
                    BTCUSDT: { price: '68432.10', cachedAt: '2026-04-01T10:00:30.000Z' },
                    ETHUSDT: { price: '3521.88', cachedAt: '2026-04-01T10:00:31.000Z' },
                },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized', type: error_response_dto_1.ErrorResponseDto }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getDashboard", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get the full trading dashboard summary' }),
    (0, swagger_1.ApiQuery)({ name: 'range', required: false, example: '1h' }),
    (0, swagger_1.ApiQuery)({ name: 'volumeTf', required: false, example: '1h' }),
    (0, swagger_1.ApiQuery)({ name: 'pnlRange', required: false, example: 'week' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Dashboard summary retrieved successfully',
        schema: {
            example: {
                success: true,
                message: 'Dashboard summary retrieved successfully',
                data: {
                    userCount: 2,
                    topMovers: [
                        {
                            symbol: 'BTCUSDT',
                            price: '68432.10',
                            volume24h: '23100.50',
                            priceChange24h: '1780.00',
                            high24h: '69310.00',
                            low24h: '66427.53',
                            fetchedAt: '2026-04-01T10:00:30.000Z',
                        },
                    ],
                    marketOverview: { btcDominance: 52.31, fearGreedIndex: 86 },
                    marketShare: [
                        { symbol: 'BTC', dominance: 52.31 },
                        { symbol: 'ETH', dominance: 31.2 },
                        { symbol: 'OTHERS', dominance: 16.49 },
                    ],
                    btcPriceTrend: {
                        range: '1h',
                        currency: 'USD',
                        livePrice: 68556,
                        change24h: 1748,
                        change24hPercent: 2.62,
                        labels: ['10:00', '11:00', '12:00'],
                        series: [68100, 68320, 68556],
                        high: 69310,
                        low: 66427.53,
                        updatedAt: '2026-04-01T10:00:30.000Z',
                    },
                    volumeProfile: {
                        timeframe: '1h',
                        labels: ['09:00', '10:00', '11:00'],
                        volume: [12000, 18000, 25582],
                        colors: ['#00E6A7', '#0EA5E9', '#FACC15'],
                        updatedAt: '2026-04-01T10:00:30.000Z',
                    },
                    dailyPnl: {
                        range: 'week',
                        weeklyNet: 1780,
                        series: [{ day: 'Mon', value: 480 }],
                        stats: { best: 820, worst: -140, avg: 255, win: 5, loss: 2 },
                        updatedAt: '2026-04-01T10:00:30.000Z',
                    },
                    openOrders: {
                        activeCount: 3,
                        totalCount: 5,
                        items: [
                            {
                                id: 'ord_001',
                                pair: 'BTC/USDT',
                                side: 'BUY',
                                type: 'Limit',
                                price: 68250,
                                amount: 0.45,
                                filledPercent: 62,
                                totalUsd: 30712.5,
                                status: 'Partial',
                                createdAtLabel: 'Apr 1, 10:00',
                            },
                        ],
                        updatedAt: '2026-04-01T10:00:30.000Z',
                    },
                    health: { db: 'up', redis: 'up', wsConnections: 3 },
                    warnings: [],
                    stale: false,
                    generatedAt: '2026-04-01T10:00:30.000Z',
                },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized', type: error_response_dto_1.ErrorResponseDto }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('summary'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('range')),
    __param(2, (0, common_1.Query)('volumeTf')),
    __param(3, (0, common_1.Query)('pnlRange')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getSummary", null);
exports.DashboardController = DashboardController = __decorate([
    (0, swagger_1.ApiTags)('Dashboard'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('dashboard'),
    __metadata("design:paramtypes", [dashboard_service_1.DashboardService])
], DashboardController);
//# sourceMappingURL=dashboard.controller.js.map