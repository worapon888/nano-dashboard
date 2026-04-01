import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersGateway } from './users.gateway';
import { UserResponseDto } from './dto/user-response.dto';
import { getDashboardSummaryCachePattern } from '../dashboard/dashboard-cache.util';

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
const PASSWORD_SALT_ROUNDS = 12;
const SOFT_DELETED_EMAIL_PREFIX = 'deleted';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly usersGateway: UsersGateway,
  ) {}

  async createUser(input: {
    email: string;
    password: string;
    displayName: string;
    role?: UserRole;
    isActive?: boolean;
  }) {
    const passwordHash = await bcrypt.hash(input.password, PASSWORD_SALT_ROUNDS);

    return this.create({
      email: input.email,
      passwordHash,
      displayName: input.displayName,
      role: input.role,
      isActive: input.isActive,
    });
  }

  async create(input: {
    email: string;
    passwordHash: string;
    displayName: string;
    role?: UserRole;
    isActive?: boolean;
  }) {
    let user: Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

    try {
      user = await this.prisma.user.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
          displayName: input.displayName,
          role: input.role ?? UserRole.USER,
          isActive: input.isActive ?? true,
        },
        select: USER_SELECT,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
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

  async updateById(
    id: string,
    updateUserDto: UpdateUserDto,
    currentUser?: {
      sub: string;
      role: UserRole;
    },
  ) {
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

  async updateUser(
    id: string,
    updateUserDto: UpdateUserDto,
    currentUser?: {
      sub: string;
      role: UserRole;
    },
  ) {
    return this.updateById(id, updateUserDto, currentUser);
  }

  async assertOwnerOrAdmin(targetUserId: string, currentUser: {
    sub: string;
    role: UserRole;
  }) {
    const exists = await this.prisma.user.findFirst({
      where: {
        id: targetUserId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('User not found');
    }

    if (currentUser.role === UserRole.ADMIN || currentUser.sub === targetUserId) {
      return;
    }

    throw new ForbiddenException('You do not have permission to modify this user');
  }

  async softDeleteById(id: string) {
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
      throw new NotFoundException('User not found');
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

  async releaseSoftDeletedEmail(email: string) {
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

  private sanitizeUpdatePayload(
    updateUserDto: UpdateUserDto,
    currentUser?: {
      sub: string;
      role: UserRole;
    },
  ): UpdateUserDto {
    if (currentUser?.role === UserRole.ADMIN) {
      return updateUserDto;
    }

    return {
      ...(updateUserDto.displayName !== undefined
        ? { displayName: updateUserDto.displayName }
        : {}),
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
        this.redisService.delByPattern(getDashboardSummaryCachePattern()),
      ]);
    } catch (error) {
      this.logger.warn(
        `User cache invalidation failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private buildArchivedEmail(email: string, userId: string): string {
    const [localPart, domain = 'deleted.local'] = email.split('@');
    const safeLocalPart = localPart.trim().toLowerCase() || 'user';
    return `${SOFT_DELETED_EMAIL_PREFIX}+${safeLocalPart}+${userId}@${domain}`;
  }
}
