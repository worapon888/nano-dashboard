import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginResponseDto, RegisterResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { CurrentUserPayload } from './interfaces/current-user-payload.interface';
import { successResponse } from '../common/utils/api-response.util';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    type: RegisterResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed', type: ErrorResponseDto })
  @ApiResponse({ status: 409, description: 'Email already exists', type: ErrorResponseDto })
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    const user = await this.authService.register(registerDto);
    return successResponse(user, 'User registered successfully');
  }

  @ApiOperation({ summary: 'Authenticate user credentials and return JWT tokens' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed', type: ErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials', type: ErrorResponseDto })
  @Post('login')
  @HttpCode(200)
  async login(@Body() loginDto: LoginDto) {
    const authResult = await this.authService.login(loginDto);
    return successResponse(authResult, 'Login successful');
  }

  @ApiOperation({ summary: 'Refresh JWT access and refresh tokens' })
  @ApiResponse({
    status: 200,
    description: 'Tokens refreshed successfully',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed', type: ErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid refresh token', type: ErrorResponseDto })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    const authResult = await this.authService.refresh(refreshTokenDto.refreshToken);
    return successResponse(authResult, 'Tokens refreshed successfully');
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiResponse({
    status: 200,
    description: 'Authenticated user retrieved successfully',
    schema: {
      example: {
        success: true,
        message: 'Authenticated user retrieved successfully',
        data: {
          id: 'c0a8012e-d8b9-4fcf-9f75-2b0d44cc0f31',
          email: 'user@example.com',
          displayName: 'Demo User',
          role: 'USER',
          isActive: true,
          createdAt: '2026-04-01T10:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() currentUser: CurrentUserPayload) {
    const user = await this.authService.me(currentUser.sub);
    return successResponse(user, 'Authenticated user retrieved successfully');
  }
}
