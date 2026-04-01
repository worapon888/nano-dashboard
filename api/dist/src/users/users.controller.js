"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const error_response_dto_1 = require("../common/dto/error-response.dto");
const api_response_util_1 = require("../common/utils/api-response.util");
const get_users_query_dto_1 = require("./dto/get-users-query.dto");
const update_user_dto_1 = require("./dto/update-user.dto");
const users_service_1 = require("./users.service");
let UsersController = class UsersController {
    usersService;
    constructor(usersService) {
        this.usersService = usersService;
    }
    async findAll(query) {
        const result = await this.usersService.findAll(query);
        return (0, api_response_util_1.successResponse)(result.items, 'Users retrieved successfully', result.meta);
    }
    async getMe(currentUser) {
        const user = await this.usersService.getMe(currentUser.sub);
        return (0, api_response_util_1.successResponse)(user, 'Authenticated user retrieved successfully');
    }
    async findById(id) {
        const user = await this.usersService.findById(id);
        return (0, api_response_util_1.successResponse)(user, 'User retrieved successfully');
    }
    async updateById(id, updateUserDto, currentUser) {
        await this.usersService.assertOwnerOrAdmin(id, currentUser);
        const user = await this.usersService.updateById(id, updateUserDto, currentUser);
        return (0, api_response_util_1.successResponse)(user, 'User updated successfully');
    }
    async softDeleteById(id, currentUser) {
        await this.usersService.assertOwnerOrAdmin(id, currentUser);
        await this.usersService.softDeleteById(id);
        return (0, api_response_util_1.successResponse)(null, 'User deleted successfully');
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'List users' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, example: 1 }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, example: 10 }),
    (0, swagger_1.ApiQuery)({ name: 'search', required: false, example: 'demo' }),
    (0, swagger_1.ApiResponse)({
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
    }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized', type: error_response_dto_1.ErrorResponseDto }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [get_users_query_dto_1.GetUsersQueryDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "findAll", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get the authenticated user profile from Users module' }),
    (0, swagger_1.ApiResponse)({
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
    }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized', type: error_response_dto_1.ErrorResponseDto }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('me'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getMe", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get a user by id' }),
    (0, swagger_1.ApiParam)({ name: 'id', example: 'c0a8012e-d8b9-4fcf-9f75-2b0d44cc0f31' }),
    (0, swagger_1.ApiResponse)({
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
    }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized', type: error_response_dto_1.ErrorResponseDto }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'User not found', type: error_response_dto_1.ErrorResponseDto }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "findById", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Update a user by id' }),
    (0, swagger_1.ApiParam)({ name: 'id', example: 'c0a8012e-d8b9-4fcf-9f75-2b0d44cc0f31' }),
    (0, swagger_1.ApiResponse)({
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
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Validation failed', type: error_response_dto_1.ErrorResponseDto }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized', type: error_response_dto_1.ErrorResponseDto }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden', type: error_response_dto_1.ErrorResponseDto }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'User not found', type: error_response_dto_1.ErrorResponseDto }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_user_dto_1.UpdateUserDto, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "updateById", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete a user by id' }),
    (0, swagger_1.ApiParam)({ name: 'id', example: 'c0a8012e-d8b9-4fcf-9f75-2b0d44cc0f31' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'User deleted successfully',
        schema: {
            example: {
                success: true,
                message: 'User deleted successfully',
                data: null,
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized', type: error_response_dto_1.ErrorResponseDto }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden', type: error_response_dto_1.ErrorResponseDto }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'User not found', type: error_response_dto_1.ErrorResponseDto }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "softDeleteById", null);
exports.UsersController = UsersController = __decorate([
    (0, swagger_1.ApiTags)('Users'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('users'),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], UsersController);
//# sourceMappingURL=users.controller.js.map