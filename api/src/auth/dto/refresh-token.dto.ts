import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsNotEmpty } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh',
    description: 'Valid JWT refresh token issued by the login endpoint',
  })
  @IsJWT()
  @IsNotEmpty()
  refreshToken!: string;
}
