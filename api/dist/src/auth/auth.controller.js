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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const error_response_dto_1 = require("../common/dto/error-response.dto");
const auth_service_1 = require("./auth.service");
const current_user_decorator_1 = require("./decorators/current-user.decorator");
const auth_response_dto_1 = require("./dto/auth-response.dto");
const login_dto_1 = require("./dto/login.dto");
const refresh_token_dto_1 = require("./dto/refresh-token.dto");
const register_dto_1 = require("./dto/register.dto");
const jwt_auth_guard_1 = require("./guards/jwt-auth.guard");
const api_response_util_1 = require("../common/utils/api-response.util");
let AuthController = class AuthController {
    authService;
    constructor(authService) {
        this.authService = authService;
    }
    async register(registerDto) {
        const user = await this.authService.register(registerDto);
        return (0, api_response_util_1.successResponse)(user, 'User registered successfully');
    }
    async login(loginDto) {
        const authResult = await this.authService.login(loginDto);
        return (0, api_response_util_1.successResponse)(authResult, 'Login successful');
    }
    async refresh(refreshTokenDto) {
        const authResult = await this.authService.refresh(refreshTokenDto.refreshToken);
        return (0, api_response_util_1.successResponse)(authResult, 'Tokens refreshed successfully');
    }
    async me(currentUser) {
        const user = await this.authService.me(currentUser.sub);
        return (0, api_response_util_1.successResponse)(user, 'Authenticated user retrieved successfully');
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Register a new user account' }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'User registered successfully',
        type: auth_response_dto_1.RegisterResponseDto,
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Validation failed', type: error_response_dto_1.ErrorResponseDto }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Email already exists', type: error_response_dto_1.ErrorResponseDto }),
    (0, common_1.Post)('register'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_dto_1.RegisterDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Authenticate user credentials and return JWT tokens' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Login successful',
        type: auth_response_dto_1.LoginResponseDto,
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Validation failed', type: error_response_dto_1.ErrorResponseDto }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid credentials', type: error_response_dto_1.ErrorResponseDto }),
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Refresh JWT access and refresh tokens' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Tokens refreshed successfully',
        type: auth_response_dto_1.LoginResponseDto,
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Validation failed', type: error_response_dto_1.ErrorResponseDto }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid refresh token', type: error_response_dto_1.ErrorResponseDto }),
    (0, common_1.Post)('refresh'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [refresh_token_dto_1.RefreshTokenDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get the authenticated user profile' }),
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
], AuthController.prototype, "me", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('Auth'),
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map