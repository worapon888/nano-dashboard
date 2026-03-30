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
var UsersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const events_tokens_1 = require("../events/events.tokens");
const prisma_service_1 = require("../prisma/prisma.service");
const redis_service_1 = require("../redis/redis.service");
const USER_SELECT = {
    id: true,
    email: true,
    displayName: true,
    role: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
};
const ACTIVE_USER_COUNT_CACHE_KEY = 'app:users:active-count';
const DASHBOARD_SUMMARY_CACHE_KEY = 'app:dashboard:summary';
let UsersService = UsersService_1 = class UsersService {
    prisma;
    redisService;
    userEventsPublisher;
    logger = new common_1.Logger(UsersService_1.name);
    constructor(prisma, redisService, userEventsPublisher) {
        this.prisma = prisma;
        this.redisService = redisService;
        this.userEventsPublisher = userEventsPublisher;
    }
    async findAll(query) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        const search = query.search?.trim();
        const where = this.buildUserWhereInput(search);
        const [items, total] = await this.prisma.$transaction([
            this.prisma.user.findMany({
                where,
                select: USER_SELECT,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.user.count({ where }),
        ]);
        return {
            items: items.map((user) => this.toUserResponse(user)),
            meta: {
                page,
                limit,
                total,
                totalPages: total === 0 ? 0 : Math.ceil(total / limit),
            },
        };
    }
    async findById(id) {
        const user = await this.prisma.user.findFirst({
            where: {
                id,
                deletedAt: null,
            },
            select: USER_SELECT,
        });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        return this.toUserResponse(user);
    }
    async findByEmail(email) {
        return this.prisma.user.findFirst({
            where: {
                email,
                deletedAt: null,
            },
        });
    }
    async getMe(userId) {
        return this.findById(userId);
    }
    async updateById(id, updateUserDto) {
        await this.ensureUserExists(id);
        const user = await this.prisma.user.update({
            where: { id },
            data: {
                ...(updateUserDto.displayName !== undefined
                    ? { displayName: updateUserDto.displayName.trim() }
                    : {}),
                ...(updateUserDto.role !== undefined ? { role: updateUserDto.role } : {}),
                ...(updateUserDto.isActive !== undefined
                    ? { isActive: updateUserDto.isActive }
                    : {}),
            },
            select: USER_SELECT,
        });
        await this.invalidateUserCaches();
        const response = this.toUserResponse(user);
        try {
            await this.userEventsPublisher?.publishUserUpdated(response);
        }
        catch (error) {
            this.logger.warn(`Non-blocking event delivery failed for user.updated (userId=${response.id}): ${error instanceof Error ? error.message : 'unknown error'}`);
        }
        return response;
    }
    async softDeleteById(id) {
        await this.ensureUserExists(id);
        await this.prisma.user.update({
            where: { id },
            data: {
                isActive: false,
                deletedAt: new Date(),
            },
        });
        await this.invalidateUserCaches();
    }
    async getActiveCount() {
        const cachedCount = await this.redisService.get(ACTIVE_USER_COUNT_CACHE_KEY);
        if (cachedCount !== null) {
            return cachedCount;
        }
        const count = await this.prisma.user.count({
            where: {
                deletedAt: null,
                isActive: true,
            },
        });
        await this.redisService.set(ACTIVE_USER_COUNT_CACHE_KEY, count, 60);
        return count;
    }
    async ensureUserExists(id) {
        const user = await this.prisma.user.findFirst({
            where: {
                id,
                deletedAt: null,
            },
            select: { id: true },
        });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
    }
    buildUserWhereInput(search) {
        if (!search) {
            return { deletedAt: null };
        }
        return {
            deletedAt: null,
            OR: [
                {
                    email: {
                        contains: search,
                        mode: 'insensitive',
                    },
                },
                {
                    displayName: {
                        contains: search,
                        mode: 'insensitive',
                    },
                },
            ],
        };
    }
    toUserResponse(user) {
        return {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }
    async invalidateUserCaches() {
        try {
            await Promise.all([
                this.redisService.del(ACTIVE_USER_COUNT_CACHE_KEY),
                this.redisService.del(DASHBOARD_SUMMARY_CACHE_KEY),
            ]);
        }
        catch (error) {
            this.logger.warn(`User cache invalidation failed: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = UsersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Optional)()),
    __param(2, (0, common_1.Inject)(events_tokens_1.USER_EVENTS_PUBLISHER)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService, Object])
], UsersService);
//# sourceMappingURL=users.service.js.map