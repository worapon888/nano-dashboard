import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'new.user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ example: 'Demo User' })
  @ValidateIf((object: RegisterDto) => object.name === undefined)
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  displayName!: string;

  @ApiPropertyOptional({ example: 'Demo User' })
  @ValidateIf((object: RegisterDto) => object.displayName === undefined)
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;
}
