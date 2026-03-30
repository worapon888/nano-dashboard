import { UserRole } from '@prisma/client';

export class UserResponseDto {
  id!: string;
  email!: string;
  displayName!: string;
  role!: UserRole;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}
