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
exports.BtcLiveVolumeUpdateDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class BtcLiveVolumeUpdateDto {
    symbol;
    timeframe;
    label;
    volume;
    color;
    direction;
    updatedAt;
}
exports.BtcLiveVolumeUpdateDto = BtcLiveVolumeUpdateDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'BTCUSDT' }),
    __metadata("design:type", String)
], BtcLiveVolumeUpdateDto.prototype, "symbol", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['15m', '1h', '4h', '1d'], example: '1h' }),
    __metadata("design:type", String)
], BtcLiveVolumeUpdateDto.prototype, "timeframe", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '14:00' }),
    __metadata("design:type", String)
], BtcLiveVolumeUpdateDto.prototype, "label", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 25582 }),
    __metadata("design:type", Number)
], BtcLiveVolumeUpdateDto.prototype, "volume", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '#00E6A7' }),
    __metadata("design:type", String)
], BtcLiveVolumeUpdateDto.prototype, "color", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['bullish', 'bearish'], example: 'bullish' }),
    __metadata("design:type", String)
], BtcLiveVolumeUpdateDto.prototype, "direction", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-01T10:00:30.000Z' }),
    __metadata("design:type", String)
], BtcLiveVolumeUpdateDto.prototype, "updatedAt", void 0);
//# sourceMappingURL=btc-live-volume-update.dto.js.map