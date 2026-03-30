import { UserRole } from '@prisma/client';
export declare class UserResponseDto {
    id: string;
    email: string;
    displayName: string;
    role: UserRole;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
