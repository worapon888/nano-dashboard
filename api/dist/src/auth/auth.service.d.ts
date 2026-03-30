import { JwtService } from '@nestjs/jwt';
import type { UserEventsPublisher } from '../events/events.tokens';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
export declare class AuthService {
    private readonly prisma;
    private readonly jwtService;
    private readonly userEventsPublisher?;
    private readonly logger;
    constructor(prisma: PrismaService, jwtService: JwtService, userEventsPublisher?: UserEventsPublisher | undefined);
    register(registerDto: RegisterDto): Promise<{
        id: string;
        email: string;
        displayName: string;
        role: import("@prisma/client").$Enums.UserRole;
        isActive: boolean;
        createdAt: Date;
    }>;
    login(loginDto: LoginDto): Promise<{
        accessToken: string;
        tokenType: string;
        expiresIn: string;
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
    private isUniqueEmailConstraintError;
    private toSafeUser;
}
