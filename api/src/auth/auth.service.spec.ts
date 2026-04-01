import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: {
    user: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
    };
  };
  let jwtService: {
    signAsync: jest.Mock;
    verifyAsync: jest.Mock;
  };
  let configService: {
    get: jest.Mock;
    getOrThrow: jest.Mock;
  };

  beforeEach(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    jwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string) =>
        key === 'JWT_REFRESH_SECRET' ? 'refresh-secret' : undefined,
      ),
      getOrThrow: jest.fn(() => 'jwt-secret'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: UsersService,
          useValue: {
            releaseSoftDeletedEmail: jest.fn(),
            createUser: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('refresh() verifies refresh token and returns a new token pair', async () => {
    prismaService.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      passwordHash: 'hashed-password',
      displayName: 'Admin User',
      role: UserRole.ADMIN,
      isActive: true,
      deletedAt: null,
    });
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
    });
    jwtService.signAsync
      .mockResolvedValueOnce('new-access-token')
      .mockResolvedValueOnce('new-refresh-token');

    const result = await service.refresh('valid-refresh-token');

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-refresh-token', {
      secret: 'refresh-secret',
    });
    expect(prismaService.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
    });
    expect(result).toEqual({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      tokenType: 'Bearer',
      expiresIn: '15m',
      refreshExpiresIn: '7d',
    });
  });

  it('refresh() throws UnauthorizedException when token verification fails', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

    await expect(service.refresh('bad-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prismaService.user.findUnique).not.toHaveBeenCalled();
  });
});
