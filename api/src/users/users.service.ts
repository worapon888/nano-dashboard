import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { USER_EVENTS_PUBLISHER } from '../events/events.tokens';
import type { UserEventsPublisher } from '../events/events.tokens';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

const USER_SELECT = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const ACTIVE_USER_COUNT_CACHE_KEY = 'app:users:active-count';
const DASHBOARD_SUMMARY_CACHE_KEY = 'app:dashboard:summary';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    @Optional()
    @Inject(USER_EVENTS_PUBLISHER)
    private readonly userEventsPublisher?: UserEventsPublisher,
  ) {}

  async findAll(query: GetUsersQueryDto) {
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

  async findById(id: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: USER_SELECT,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toUserResponse(user);
  }

  async findByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });
  }

  async getMe(userId: string) {
    return this.findById(userId);
  }

  async updateById(id: string, updateUserDto: UpdateUserDto) {
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

    // Fire-and-forget: broadcast failures must not fail the mutation.
    try {
      await this.userEventsPublisher?.publishUserUpdated(
        response as unknown as Record<string, unknown>,
      );
    } catch (error) {
      this.logger.warn(
        `Non-blocking event delivery failed for user.updated (userId=${response.id}): ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }

    return response;
  }

  async softDeleteById(id: string) {
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
    const cachedCount = await this.redisService.get<number>(
      ACTIVE_USER_COUNT_CACHE_KEY,
    );

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

  private async ensureUserExists(id: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
  }

  private buildUserWhereInput(search?: string): Prisma.UserWhereInput {
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

  private toUserResponse(
    user: Prisma.UserGetPayload<{ select: typeof USER_SELECT }>,
  ): UserResponseDto {
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

  private async invalidateUserCaches() {
    try {
      await Promise.all([
        this.redisService.del(ACTIVE_USER_COUNT_CACHE_KEY),
        this.redisService.del(DASHBOARD_SUMMARY_CACHE_KEY),
      ]);
    } catch (error) {
      this.logger.warn(
        `User cache invalidation failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }
}
