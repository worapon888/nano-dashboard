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
exports.BtcLivePriceUpdateDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class BtcLivePriceUpdateDto {
    symbol;
    price;
    change24h;
    change24hPercent;
    high24h;
    low24h;
    updatedAt;
}
exports.BtcLivePriceUpdateDto = BtcLivePriceUpdateDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'BTCUSDT' }),
    __metadata("design:type", String)
], BtcLivePriceUpdateDto.prototype, "symbol", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 68432.1 }),
    __metadata("design:type", Number)
], BtcLivePriceUpdateDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1780 }),
    __metadata("design:type", Number)
], BtcLivePriceUpdateDto.prototype, "change24h", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 2.67 }),
    __metadata("design:type", Number)
], BtcLivePriceUpdateDto.prototype, "change24hPercent", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 69310 }),
    __metadata("design:type", Number)
], BtcLivePriceUpdateDto.prototype, "high24h", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 66427.53 }),
    __metadata("design:type", Number)
], BtcLivePriceUpdateDto.prototype, "low24h", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-01T10:00:30.000Z' }),
    __metadata("design:type", String)
], BtcLivePriceUpdateDto.prototype, "updatedAt", void 0);
//# sourceMappingURL=btc-live-price-update.dto.js.map