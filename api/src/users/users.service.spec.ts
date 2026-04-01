import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { UsersGateway } from './users.gateway';
import { UsersService } from './users.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

describe('UsersService', () => {
  const createdAt = new Date('2026-04-01T10:00:00.000Z');
  const updatedAt = new Date('2026-04-01T10:05:00.000Z');

  let service: UsersService;
  let prismaService: {
    user: {
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
  };
  let redisService: {
    del: jest.Mock;
    delByPattern: jest.Mock;
    get: jest.Mock;
    set: jest.Mock;
  };
  let usersGateway: {
    emitUserCreated: jest.Mock;
    emitUserUpdated: jest.Mock;
  };

  beforeEach(async () => {
    prismaService = {
      user: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };
    redisService = {
      del: jest.fn().mockResolvedValue(undefined),
      delByPattern: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
      set: jest.fn(),
    };
    usersGateway = {
      emitUserCreated: jest.fn(),
      emitUserUpdated: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: RedisService,
          useValue: redisService,
        },
        {
          provide: UsersGateway,
          useValue: usersGateway,
        },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('createUser() hashes password and returns user without password field', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    prismaService.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'tester@example.com',
      displayName: 'Tester',
      role: UserRole.USER,
      isActive: true,
      createdAt,
      updatedAt,
    });

    const result = await service.createUser({
      email: 'tester@example.com',
      password: 'plain-password',
      displayName: 'Tester',
    });

    expect(bcrypt.hash).toHaveBeenCalledWith('plain-password', 12);
    expect(prismaService.user.create).toHaveBeenCalledWith({
      data: {
        email: 'tester@example.com',
        passwordHash: 'hashed-password',
        displayName: 'Tester',
        role: UserRole.USER,
        isActive: true,
      },
      select: expect.any(Object),
    });
    expect(result).toEqual({
      id: 'user-1',
      email: 'tester@example.com',
      displayName: 'Tester',
      role: UserRole.USER,
      isActive: true,
      createdAt,
      updatedAt,
    });
    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('findById() throws NotFoundException when user does not exist', async () => {
    prismaService.user.findFirst.mockResolvedValue(null);

    await expect(service.findById('missing-user')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updateUser() emits user.updated event', async () => {
    prismaService.user.findFirst.mockResolvedValue({ id: 'user-1' });
    prismaService.user.update.mockResolvedValue({
      id: 'user-1',
      email: 'tester@example.com',
      displayName: 'Tester Updated',
      role: UserRole.USER,
      isActive: true,
      createdAt,
      updatedAt,
    });

    const result = await service.updateUser(
      'user-1',
      { displayName: 'Tester Updated' },
      { sub: 'user-1', role: UserRole.USER },
    );

    expect(result.displayName).toBe('Tester Updated');
    expect(usersGateway.emitUserUpdated).toHaveBeenCalledTimes(1);
    expect(usersGateway.emitUserUpdated).toHaveBeenCalledWith({
      id: 'user-1',
      name: 'Tester Updated',
      email: 'tester@example.com',
      updatedAt,
    });
  });

  it('softDeleteById() archives the email before marking the user deleted', async () => {
    prismaService.user.findFirst.mockResolvedValueOnce({
      id: 'user-1',
      email: 'tester@example.com',
    });
    prismaService.user.update.mockResolvedValue(undefined);

    await service.softDeleteById('user-1');

    expect(prismaService.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        email: 'deleted+tester+user-1@example.com',
        isActive: false,
        deletedAt: expect.any(Date),
      }),
    });
  });
});
