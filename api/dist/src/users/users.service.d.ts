import type { UserEventsPublisher } from '../events/events.tokens';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
export declare class UsersService {
    private readonly prisma;
    private readonly redisService;
    private readonly userEventsPublisher?;
    private readonly logger;
    constructor(prisma: PrismaService, redisService: RedisService, userEventsPublisher?: UserEventsPublisher | undefined);
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
    updateById(id: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto>;
    softDeleteById(id: string): Promise<void>;
    getActiveCount(): Promise<number>;
    private ensureUserExists;
    private buildUserWhereInput;
    private toUserResponse;
    private invalidateUserCaches;
}
