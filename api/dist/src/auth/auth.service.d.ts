import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
export declare class AuthService {
    private readonly prisma;
    private readonly jwtService;
    private readonly configService;
    private readonly usersService;
    constructor(prisma: PrismaService, jwtService: JwtService, configService: ConfigService, usersService: UsersService);
    register(registerDto: RegisterDto): Promise<import("../users/dto/user-response.dto").UserResponseDto>;
    login(loginDto: LoginDto): Promise<{
        accessToken: string;
        refreshToken: string;
        tokenType: string;
        expiresIn: string;
        refreshExpiresIn: string;
    }>;
    refresh(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
        tokenType: string;
        expiresIn: string;
        refreshExpiresIn: string;
    }>;
    me(userId: string): Promise<{
        id: string;
        email: string;
        displayName: string;
        role: import("@prisma/client").$Enums.UserRole;
        isActive: boolean;
        createdAt: Date;
    }>;
    private normalizeEmail;
    private normalizeDisplayName;
    private getRefreshTokenSecret;
    private issueTokensForUser;
    private isUniqueEmailConstraintError;
    private toSafeUser;
}
