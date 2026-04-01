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
exports.TickerDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class TickerDto {
    symbol;
    price;
    volume24h;
    priceChange24h;
    priceChange24hPercent;
    high24h;
    low24h;
    fetchedAt;
    source;
    cacheSource;
    stale;
}
exports.TickerDto = TickerDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'BTCUSDT' }),
    __metadata("design:type", String)
], TickerDto.prototype, "symbol", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '68432.10' }),
    __metadata("design:type", String)
], TickerDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '23100.50', nullable: true }),
    __metadata("design:type", Object)
], TickerDto.prototype, "volume24h", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '1780.00', nullable: true }),
    __metadata("design:type", Object)
], TickerDto.prototype, "priceChange24h", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2.67', nullable: true }),
    __metadata("design:type", Object)
], TickerDto.prototype, "priceChange24hPercent", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '69310.00', nullable: true }),
    __metadata("design:type", Object)
], TickerDto.prototype, "high24h", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '66427.53', nullable: true }),
    __metadata("design:type", Object)
], TickerDto.prototype, "low24h", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-01T10:00:30.000Z' }),
    __metadata("design:type", String)
], TickerDto.prototype, "fetchedAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'binance' }),
    __metadata("design:type", String)
], TickerDto.prototype, "source", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['fresh', 'hot', 'stale'], example: 'hot' }),
    __metadata("design:type", String)
], TickerDto.prototype, "cacheSource", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: false }),
    __metadata("design:type", Boolean)
], TickerDto.prototype, "stale", void 0);
//# sourceMappingURL=ticker.dto.js.map