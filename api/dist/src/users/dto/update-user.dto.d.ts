import { UserRole } from '@prisma/client';
export declare class UpdateUserDto {
    displayName?: string;
    role?: UserRole;
    isActive?: boolean;
}
