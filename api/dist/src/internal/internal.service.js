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
var InternalService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalService = void 0;
const common_1 = require("@nestjs/common");
const events_tokens_1 = require("../events/events.tokens");
const prisma_service_1 = require("../prisma/prisma.service");
const redis_service_1 = require("../redis/redis.service");
let InternalService = InternalService_1 = class InternalService {
    prisma;
    redisService;
    websocketProvider;
    logger = new common_1.Logger(InternalService_1.name);
    constructor(prisma, redisService, websocketProvider) {
        this.prisma = prisma;
        this.redisService = redisService;
        this.websocketProvider = websocketProvider;
    }
    async getQuickHealth() {
        const [db, redis, wsConnections] = await Promise.all([
            this.getDatabaseHealth(),
            this.getRedisHealth(),
            this.getWsConnectionCount(),
        ]);
        return {
            db,
            redis,
            wsConnections,
        };
    }
    async getDatabaseHealth() {
        if (!this.prisma) {
            return 'unknown';
        }
        try {
            await this.prisma.$queryRaw `SELECT 1`;
            return 'up';
        }
        catch (error) {
            this.logger.warn(`Database health check failed: ${error instanceof Error ? error.message : 'unknown error'}`);
            return 'down';
        }
    }
    async getRedisHealth() {
        if (!this.redisService) {
            return 'unknown';
        }
        try {
            return (await this.redisService.ping()) ? 'up' : 'down';
        }
        catch (error) {
            this.logger.warn(`Redis health check failed: ${error instanceof Error ? error.message : 'unknown error'}`);
            return 'down';
        }
    }
    async getWsConnectionCount() {
        if (!this.websocketProvider?.getConnectionCount) {
            return 0;
        }
        try {
            const connectionCount = await this.websocketProvider.getConnectionCount();
            return typeof connectionCount === 'number' ? connectionCount : 0;
        }
        catch (error) {
            this.logger.warn(`Websocket connection health check failed: ${error instanceof Error ? error.message : 'unknown error'}`);
            return 0;
        }
    }
};
exports.InternalService = InternalService;
exports.InternalService = InternalService = InternalService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Optional)()),
    __param(2, (0, common_1.Inject)(events_tokens_1.WS_CONNECTIONS_PROVIDER)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService, Object])
], InternalService);
//# sourceMappingURL=internal.service.js.map