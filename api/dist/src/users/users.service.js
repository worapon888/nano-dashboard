"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var UsersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const client_2 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma_service_1 = require("../prisma/prisma.service");
const redis_service_1 = require("../redis/redis.service");
const users_gateway_1 = require("./users.gateway");
const dashboard_cache_util_1 = require("../dashboard/dashboard-cache.util");
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
const PASSWORD_SALT_ROUNDS = 12;
const SOFT_DELETED_EMAIL_PREFIX = 'deleted';
let UsersService = UsersService_1 = class UsersService {
    prisma;
    redisService;
    usersGateway;
    logger = new common_1.Logger(UsersService_1.name);
    constructor(prisma, redisService, usersGateway) {
        this.prisma = prisma;
        this.redisService = redisService;
        this.usersGateway = usersGateway;
    }
    async createUser(input) {
        const passwordHash = await bcrypt.hash(input.password, PASSWORD_SALT_ROUNDS);
        return this.create({
            email: input.email,
            passwordHash,
            displayName: input.displayName,
            role: input.role,
            isActive: input.isActive,
        });
    }
    async create(input) {
        let user;
        try {
            user = await this.prisma.user.create({
                data: {
                    email: input.email,
                    passwordHash: input.passwordHash,
                    displayName: input.displayName,
                    role: input.role ?? client_2.UserRole.USER,
                    isActive: input.isActive ?? true,
                },
                select: USER_SELECT,
            });
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw error;
            }
            throw error;
        }
        await this.invalidateUserCaches();
        const response = this.toUserResponse(user);
        this.usersGateway.emitUserCreated({
            id: response.id,
            name: response.displayName,
            email: response.email,
            createdAt: response.createdAt,
        });
        return response;
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
    async updateById(id, updateUserDto, currentUser) {
        await this.ensureUserExists(id);
        const sanitizedUpdate = this.sanitizeUpdatePayload(updateUserDto, currentUser);
        const user = await this.prisma.user.update({
            where: { id },
            data: {
                ...(sanitizedUpdate.displayName !== undefined
                    ? { displayName: sanitizedUpdate.displayName.trim() }
                    : {}),
                ...(sanitizedUpdate.role !== undefined ? { role: sanitizedUpdate.role } : {}),
                ...(sanitizedUpdate.isActive !== undefined
                    ? { isActive: sanitizedUpdate.isActive }
                    : {}),
            },
            select: USER_SELECT,
        });
        await this.invalidateUserCaches();
        const response = this.toUserResponse(user);
        this.usersGateway.emitUserUpdated({
            id: response.id,
            name: response.displayName,
            email: response.email,
            updatedAt: response.updatedAt,
        });
        return response;
    }
    async updateUser(id, updateUserDto, currentUser) {
        return this.updateById(id, updateUserDto, currentUser);
    }
    async assertOwnerOrAdmin(targetUserId, currentUser) {
        const exists = await this.prisma.user.findFirst({
            where: {
                id: targetUserId,
                deletedAt: null,
            },
            select: { id: true },
        });
        if (!exists) {
            throw new common_1.NotFoundException('User not found');
        }
        if (currentUser.role === client_2.UserRole.ADMIN || currentUser.sub === targetUserId) {
            return;
        }
        throw new common_1.ForbiddenException('You do not have permission to modify this user');
    }
    async softDeleteById(id) {
        const user = await this.prisma.user.findFirst({
            where: {
                id,
                deletedAt: null,
            },
            select: {
                id: true,
                email: true,
            },
        });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        await this.prisma.user.update({
            where: { id },
            data: {
                email: this.buildArchivedEmail(user.email, user.id),
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
    async getDashboardUsersSnapshot() {
        const [total, active, items] = await Promise.all([
            this.prisma.user.count({
                where: {
                    deletedAt: null,
                },
            }),
            this.getActiveCount(),
            this.prisma.user.findMany({
                where: {
                    deletedAt: null,
                },
                select: USER_SELECT,
                orderBy: { createdAt: 'desc' },
            }),
        ]);
        return {
            total,
            active,
            list: items.map((user) => this.toUserResponse(user)),
        };
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
    async releaseSoftDeletedEmail(email) {
        const normalizedEmail = email.trim().toLowerCase();
        const deletedUser = await this.prisma.user.findFirst({
            where: {
                email: normalizedEmail,
                NOT: {
                    deletedAt: null,
                },
            },
            select: {
                id: true,
                email: true,
            },
        });
        if (!deletedUser) {
            return;
        }
        await this.prisma.user.update({
            where: { id: deletedUser.id },
            data: {
                email: this.buildArchivedEmail(deletedUser.email, deletedUser.id),
            },
        });
    }
    sanitizeUpdatePayload(updateUserDto, currentUser) {
        if (currentUser?.role === client_2.UserRole.ADMIN) {
            return updateUserDto;
        }
        return {
            ...(updateUserDto.displayName !== undefined
                ? { displayName: updateUserDto.displayName }
                : {}),
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
                this.redisService.delByPattern((0, dashboard_cache_util_1.getDashboardSummaryCachePattern)()),
            ]);
        }
        catch (error) {
            this.logger.warn(`User cache invalidation failed: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
    }
    buildArchivedEmail(email, userId) {
        const [localPart, domain = 'deleted.local'] = email.split('@');
        const safeLocalPart = localPart.trim().toLowerCase() || 'user';
        return `${SOFT_DELETED_EMAIL_PREFIX}+${safeLocalPart}+${userId}@${domain}`;
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = UsersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        users_gateway_1.UsersGateway])
], UsersService);
//# sourceMappingURL=users.service.js.map