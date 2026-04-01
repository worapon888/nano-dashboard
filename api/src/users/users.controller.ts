import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { CurrentUserPayload } from '../auth/interfaces/current-user-payload.interface';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { successResponse } from '../common/utils/api-response.util';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'List users' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'search', required: false, example: 'demo' })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
    schema: {
      example: {
        success: true,
        message: 'Users retrieved successfully',
        data: [
          {
            id: 'c0a8012e-d8b9-4fcf-9f75-2b0d44cc0f31',
            email: 'user@example.com',
            displayName: 'Demo User',
            role: 'USER',
            isActive: true,
            createdAt: '2026-04-01T10:00:00.000Z',
            updatedAt: '2026-04-01T10:10:00.000Z',
          },
        ],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@Query() query: GetUsersQueryDto) {
    const result = await this.usersService.findAll(query);
    return successResponse(
      result.items,
      'Users retrieved successfully',
      result.meta,
    );
  }

  @ApiOperation({ summary: 'Get the authenticated user profile from Users module' })
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
          updatedAt: '2026-04-01T10:10:00.000Z',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() currentUser: CurrentUserPayload) {
    const user = await this.usersService.getMe(currentUser.sub);
    return successResponse(user, 'Authenticated user retrieved successfully');
  }

  @ApiOperation({ summary: 'Get a user by id' })
  @ApiParam({ name: 'id', example: 'c0a8012e-d8b9-4fcf-9f75-2b0d44cc0f31' })
  @ApiResponse({
    status: 200,
    description: 'User retrieved successfully',
    schema: {
      example: {
        success: true,
        message: 'User retrieved successfully',
        data: {
          id: 'c0a8012e-d8b9-4fcf-9f75-2b0d44cc0f31',
          email: 'user@example.com',
          displayName: 'Demo User',
          role: 'USER',
          isActive: true,
          createdAt: '2026-04-01T10:00:00.000Z',
          updatedAt: '2026-04-01T10:10:00.000Z',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'User not found', type: ErrorResponseDto })
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findById(@Param('id', new ParseUUIDPipe()) id: string) {
    const user = await this.usersService.findById(id);
    return successResponse(user, 'User retrieved successfully');
  }

  @ApiOperation({ summary: 'Update a user by id' })
  @ApiParam({ name: 'id', example: 'c0a8012e-d8b9-4fcf-9f75-2b0d44cc0f31' })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    schema: {
      example: {
        success: true,
        message: 'User updated successfully',
        data: {
          id: 'c0a8012e-d8b9-4fcf-9f75-2b0d44cc0f31',
          email: 'user@example.com',
          displayName: 'Updated Name',
          role: 'USER',
          isActive: true,
          createdAt: '2026-04-01T10:00:00.000Z',
          updatedAt: '2026-04-01T10:15:00.000Z',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation failed', type: ErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'User not found', type: ErrorResponseDto })
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async updateById(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    await this.usersService.assertOwnerOrAdmin(id, currentUser);
    const user = await this.usersService.updateById(id, updateUserDto, currentUser);
    return successResponse(user, 'User updated successfully');
  }

  @ApiOperation({ summary: 'Soft delete a user by id' })
  @ApiParam({ name: 'id', example: 'c0a8012e-d8b9-4fcf-9f75-2b0d44cc0f31' })
  @ApiResponse({
    status: 200,
    description: 'User deleted successfully',
    schema: {
      example: {
        success: true,
        message: 'User deleted successfully',
        data: null,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'User not found', type: ErrorResponseDto })
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async softDeleteById(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    await this.usersService.assertOwnerOrAdmin(id, currentUser);
    await this.usersService.softDeleteById(id);
    return successResponse(null, 'User deleted successfully');
  }
}
