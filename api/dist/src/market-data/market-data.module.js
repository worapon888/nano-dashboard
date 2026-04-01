"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketDataModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const binance_module_1 = require("../binance/binance.module");
const redis_module_1 = require("../redis/redis.module");
const btc_price_live_service_1 = require("./btc-price-live.service");
const btc_volume_live_service_1 = require("./btc-volume-live.service");
const market_data_controller_1 = require("./market-data.controller");
const market_data_service_1 = require("./market-data.service");
let MarketDataModule = class MarketDataModule {
};
exports.MarketDataModule = MarketDataModule;
exports.MarketDataModule = MarketDataModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, binance_module_1.BinanceModule, redis_module_1.RedisModule],
        controllers: [market_data_controller_1.MarketDataController],
        providers: [market_data_service_1.MarketDataService, btc_price_live_service_1.BtcPriceLiveService, btc_volume_live_service_1.BtcVolumeLiveService],
        exports: [market_data_service_1.MarketDataService],
    })
], MarketDataModule);
//# sourceMappingURL=market-data.module.js.map