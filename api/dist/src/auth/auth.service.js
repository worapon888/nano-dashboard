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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const common_2 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma_service_1 = require("../prisma/prisma.service");
const users_service_1 = require("../users/users.service");
const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';
let AuthService = class AuthService {
    prisma;
    jwtService;
    configService;
    usersService;
    constructor(prisma, jwtService, configService, usersService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.configService = configService;
        this.usersService = usersService;
    }
    async register(registerDto) {
        const email = this.normalizeEmail(registerDto.email);
        const displayName = this.normalizeDisplayName(registerDto);
        const existingUser = await this.prisma.user.findFirst({
            where: {
                email,
                deletedAt: null,
            },
            select: { id: true },
        });
        if (existingUser) {
            throw new common_1.ConflictException('Email already exists');
        }
        await this.usersService.releaseSoftDeletedEmail(email);
        try {
            return await this.usersService.createUser({
                email,
                password: registerDto.password,
                displayName,
                role: client_1.UserRole.USER,
                isActive: true,
            });
        }
        catch (error) {
            if (this.isUniqueEmailConstraintError(error)) {
                throw new common_1.ConflictException('Email already exists');
            }
            throw error;
        }
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
        return this.issueTokensForUser(user);
    }
    async refresh(refreshToken) {
        let decoded;
        try {
            decoded = await this.jwtService.verifyAsync(refreshToken, {
                secret: this.getRefreshTokenSecret(),
            });
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
        if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
        const user = await this.prisma.user.findUnique({
            where: { id: decoded.sub },
        });
        if (!user || user.deletedAt || !user.isActive) {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
        return this.issueTokensForUser(user);
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
    normalizeDisplayName(registerDto) {
        const value = registerDto.name ?? registerDto.displayName;
        return value.trim();
    }
    getRefreshTokenSecret() {
        return (this.configService.get('JWT_REFRESH_SECRET') ??
            this.configService.getOrThrow('JWT_SECRET'));
    }
    async issueTokensForUser(user) {
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
        };
        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                expiresIn: ACCESS_TOKEN_EXPIRES_IN,
            }),
            this.jwtService.signAsync(payload, {
                secret: this.getRefreshTokenSecret(),
                expiresIn: REFRESH_TOKEN_EXPIRES_IN,
            }),
        ]);
        return {
            accessToken,
            refreshToken,
            tokenType: 'Bearer',
            expiresIn: ACCESS_TOKEN_EXPIRES_IN,
            refreshExpiresIn: REFRESH_TOKEN_EXPIRES_IN,
        };
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
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_2.Inject)((0, common_2.forwardRef)(() => users_service_1.UsersService))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService,
        users_service_1.UsersService])
], AuthService);
//# sourceMappingURL=auth.service.js.map