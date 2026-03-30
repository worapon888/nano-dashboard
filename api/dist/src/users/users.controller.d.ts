import type { CurrentUserPayload } from '../auth/interfaces/current-user-payload.interface';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    findAll(query: GetUsersQueryDto): Promise<{
        meta?: Record<string, any> | undefined;
        success: boolean;
        message: string;
        data: import("./dto/user-response.dto").UserResponseDto[];
    }>;
    getMe(currentUser: CurrentUserPayload): Promise<{
        meta?: Record<string, any> | undefined;
        success: boolean;
        message: string;
        data: import("./dto/user-response.dto").UserResponseDto;
    }>;
    findById(id: string): Promise<{
        meta?: Record<string, any> | undefined;
        success: boolean;
        message: string;
        data: import("./dto/user-response.dto").UserResponseDto;
    }>;
    updateById(id: string, updateUserDto: UpdateUserDto): Promise<{
        meta?: Record<string, any> | undefined;
        success: boolean;
        message: string;
        data: import("./dto/user-response.dto").UserResponseDto;
    }>;
    softDeleteById(id: string): Promise<{
        meta?: Record<string, any> | undefined;
        success: boolean;
        message: string;
        data: null;
    }>;
}
