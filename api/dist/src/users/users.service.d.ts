import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersGateway } from './users.gateway';
import { UserResponseDto } from './dto/user-response.dto';
export declare class UsersService {
    private readonly prisma;
    private readonly redisService;
    private readonly usersGateway;
    private readonly logger;
    constructor(prisma: PrismaService, redisService: RedisService, usersGateway: UsersGateway);
    createUser(input: {
        email: string;
        password: string;
        displayName: string;
        role?: UserRole;
        isActive?: boolean;
    }): Promise<UserResponseDto>;
    create(input: {
        email: string;
        passwordHash: string;
        displayName: string;
        role?: UserRole;
        isActive?: boolean;
    }): Promise<UserResponseDto>;
    findAll(query: GetUsersQueryDto): Promise<{
        items: UserResponseDto[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    findById(id: string): Promise<UserResponseDto>;
    findByEmail(email: string): Promise<{
        id: string;
        email: string;
        passwordHash: string;
        displayName: string;
        role: import("@prisma/client").$Enums.UserRole;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
    } | null>;
    getMe(userId: string): Promise<UserResponseDto>;
    updateById(id: string, updateUserDto: UpdateUserDto, currentUser?: {
        sub: string;
        role: UserRole;
    }): Promise<UserResponseDto>;
    updateUser(id: string, updateUserDto: UpdateUserDto, currentUser?: {
        sub: string;
        role: UserRole;
    }): Promise<UserResponseDto>;
    assertOwnerOrAdmin(targetUserId: string, currentUser: {
        sub: string;
        role: UserRole;
    }): Promise<void>;
    softDeleteById(id: string): Promise<void>;
    getActiveCount(): Promise<number>;
    getDashboardUsersSnapshot(): Promise<{
        total: number;
        active: number;
        list: UserResponseDto[];
    }>;
    private ensureUserExists;
    private buildUserWhereInput;
    releaseSoftDeletedEmail(email: string): Promise<void>;
    private sanitizeUpdatePayload;
    private toUserResponse;
    private invalidateUserCaches;
    private buildArchivedEmail;
}
