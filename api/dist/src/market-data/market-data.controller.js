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
exports.MarketDataController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const error_response_dto_1 = require("../common/dto/error-response.dto");
const api_response_util_1 = require("../common/utils/api-response.util");
const market_data_service_1 = require("./market-data.service");
let MarketDataController = class MarketDataController {
    marketDataService;
    constructor(marketDataService) {
        this.marketDataService = marketDataService;
    }
    async getTicker(symbol) {
        const ticker = await this.marketDataService.getTicker(symbol);
        return (0, api_response_util_1.successResponse)(ticker, 'Ticker retrieved successfully');
    }
};
exports.MarketDataController = MarketDataController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get ticker data by symbol' }),
    (0, swagger_1.ApiParam)({ name: 'symbol', example: 'BTCUSDT' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Ticker retrieved successfully',
        schema: {
            example: {
                success: true,
                message: 'Ticker retrieved successfully',
                data: {
                    symbol: 'BTCUSDT',
                    price: '68432.10',
                    volume24h: '23100.50',
                    priceChange24h: '1780.00',
                    priceChange24hPercent: '2.67',
                    high24h: '69310.00',
                    low24h: '66427.53',
                    fetchedAt: '2026-04-01T10:00:30.000Z',
                    source: 'binance',
                },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized', type: error_response_dto_1.ErrorResponseDto }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('ticker/:symbol'),
    __param(0, (0, common_1.Param)('symbol')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MarketDataController.prototype, "getTicker", null);
exports.MarketDataController = MarketDataController = __decorate([
    (0, swagger_1.ApiTags)('Market Data'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('market'),
    __metadata("design:paramtypes", [market_data_service_1.MarketDataService])
], MarketDataController);
//# sourceMappingURL=market-data.controller.js.map