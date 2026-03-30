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
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const market_data_service_1 = require("../market-data/market-data.service");
const redis_service_1 = require("../redis/redis.service");
const users_service_1 = require("../users/users.service");
let DashboardService = class DashboardService {
    usersService;
    marketDataService;
    redisService;
    constructor(usersService, marketDataService, redisService) {
        this.usersService = usersService;
        this.marketDataService = marketDataService;
        this.redisService = redisService;
    }
    async getSummary(userId) {
        const [user, btcTicker] = await Promise.all([
            this.usersService.findById(userId),
            this.marketDataService.getTicker('BTCUSDT'),
        ]);
        const summary = {
            user,
            watchlist: ['BTCUSDT'],
            market: {
                primaryTicker: btcTicker,
            },
            generatedAt: new Date().toISOString(),
        };
        await this.redisService.set(`dashboard:summary:${userId}`, summary, 15);
        return summary;
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        market_data_service_1.MarketDataService,
        redis_service_1.RedisService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map