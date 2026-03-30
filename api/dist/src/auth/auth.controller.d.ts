import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { CurrentUserPayload } from './interfaces/current-user-payload.interface';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(registerDto: RegisterDto): Promise<{
        meta?: Record<string, any> | undefined;
        success: boolean;
        message: string;
        data: {
            id: string;
            email: string;
            displayName: string;
            role: import("@prisma/client").$Enums.UserRole;
            isActive: boolean;
            createdAt: Date;
        };
    }>;
    login(loginDto: LoginDto): Promise<{
        meta?: Record<string, any> | undefined;
        success: boolean;
        message: string;
        data: {
            accessToken: string;
            tokenType: string;
            expiresIn: string;
        };
    }>;
    me(currentUser: CurrentUserPayload): Promise<{
        meta?: Record<string, any> | undefined;
        success: boolean;
        message: string;
        data: {
            id: string;
            email: string;
            displayName: string;
            role: import("@prisma/client").$Enums.UserRole;
            isActive: boolean;
            createdAt: Date;
        };
    }>;
}
