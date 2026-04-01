import { UserRole } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: 'c0a8012e-d8b9-4fcf-9f75-2b0d44cc0f31' })
  id!: string;
  @ApiProperty({ example: 'user@example.com' })
  email!: string;
  @ApiProperty({ example: 'Demo User' })
  displayName!: string;
  @ApiProperty({ enum: UserRole, example: UserRole.USER })
  role!: UserRole;
  @ApiProperty({ example: true })
  isActive!: boolean;
  @ApiProperty({ example: '2026-04-01T10:00:00.000Z' })
  createdAt!: Date;
  @ApiProperty({ example: '2026-04-01T10:10:00.000Z' })
  updatedAt!: Date;
}
