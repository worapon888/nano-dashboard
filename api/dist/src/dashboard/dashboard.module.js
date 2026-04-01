"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardModule = void 0;
const common_1 = require("@nestjs/common");
const binance_module_1 = require("../binance/binance.module");
const internal_module_1 = require("../internal/internal.module");
const market_data_module_1 = require("../market-data/market-data.module");
const orders_module_1 = require("../orders/orders.module");
const pnl_module_1 = require("../pnl/pnl.module");
const redis_module_1 = require("../redis/redis.module");
const users_module_1 = require("../users/users.module");
const dashboard_controller_1 = require("./dashboard.controller");
const dashboard_service_1 = require("./dashboard.service");
let DashboardModule = class DashboardModule {
};
exports.DashboardModule = DashboardModule;
exports.DashboardModule = DashboardModule = __decorate([
    (0, common_1.Module)({
        imports: [
            binance_module_1.BinanceModule,
            users_module_1.UsersModule,
            market_data_module_1.MarketDataModule,
            orders_module_1.OrdersModule,
            pnl_module_1.PnlModule,
            redis_module_1.RedisModule,
            internal_module_1.InternalModule,
        ],
        controllers: [dashboard_controller_1.DashboardController],
        providers: [dashboard_service_1.DashboardService],
        exports: [dashboard_service_1.DashboardService],
    })
], DashboardModule);
//# sourceMappingURL=dashboard.module.js.map