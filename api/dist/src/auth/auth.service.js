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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const events_tokens_1 = require("../events/events.tokens");
const prisma_service_1 = require("../prisma/prisma.service");
const ACCESS_TOKEN_EXPIRES_IN = '15m';
const PASSWORD_SALT_ROUNDS = 12;
let AuthService = AuthService_1 = class AuthService {
    prisma;
    jwtService;
    userEventsPublisher;
    logger = new common_1.Logger(AuthService_1.name);
    constructor(prisma, jwtService, userEventsPublisher) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.userEventsPublisher = userEventsPublisher;
    }
    async register(registerDto) {
        const email = this.normalizeEmail(registerDto.email);
        const existingUser = await this.prisma.user.findUnique({
            where: { email },
            select: { id: true },
        });
        if (existingUser) {
            throw new common_1.ConflictException('Email already exists');
        }
        const passwordHash = await bcrypt.hash(registerDto.password, PASSWORD_SALT_ROUNDS);
        let user;
        try {
            user = await this.prisma.user.create({
                data: {
                    email,
                    passwordHash,
                    displayName: registerDto.displayName.trim(),
                    role: client_1.UserRole.USER,
                    isActive: true,
                },
            });
        }
        catch (error) {
            if (this.isUniqueEmailConstraintError(error)) {
                throw new common_1.ConflictException('Email already exists');
            }
            throw error;
        }
        const safeUser = this.toSafeUser(user);
        try {
            await this.userEventsPublisher?.publishUserCreated(safeUser);
        }
        catch (error) {
            this.logger.warn(`Non-blocking event delivery failed for user.created (userId=${safeUser.id}, email=${safeUser.email}): ${error instanceof Error ? error.message : 'unknown error'}`);
        }
        return safeUser;
    }
    async login(loginDto) {
        const email = this.normalizeEmail(loginDto.email);
        const user = await this.prisma.user.findUnique({
            where: { email },
        });
        if (!user || user.deletedAt || !user.isActive) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
        };
        const accessToken = await this.jwtService.signAsync(payload, {
            expiresIn: ACCESS_TOKEN_EXPIRES_IN,
        });
        return {
            accessToken,
            tokenType: 'Bearer',
            expiresIn: ACCESS_TOKEN_EXPIRES_IN,
        };
    }
    async me(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        if (user.deletedAt || !user.isActive) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        return this.toSafeUser(user);
    }
    normalizeEmail(email) {
        return email.trim().toLowerCase();
    }
    isUniqueEmailConstraintError(error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            return error.code === 'P2002';
        }
        return (typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === 'P2002');
    }
    toSafeUser(user) {
        return {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            isActive: user.isActive,
            createdAt: user.createdAt,
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Optional)()),
    __param(2, (0, common_1.Inject)(events_tokens_1.USER_EVENTS_PUBLISHER)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService, Object])
], AuthService);
//# sourceMappingURL=auth.service.js.map