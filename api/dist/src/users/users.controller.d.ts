import type { CurrentUserPayload } from '../auth/interfaces/current-user-payload.interface';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    findAll(query: GetUsersQueryDto): Promise<{
        items: import("./dto/user-response.dto").UserResponseDto[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    getMe(currentUser: CurrentUserPayload): Promise<import("./dto/user-response.dto").UserResponseDto>;
    findById(id: string): Promise<import("./dto/user-response.dto").UserResponseDto>;
    updateById(id: string, updateUserDto: UpdateUserDto): Promise<import("./dto/user-response.dto").UserResponseDto>;
    softDeleteById(id: string): Promise<{
        success: boolean;
    }>;
}
