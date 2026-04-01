import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto';

export class DashboardUsersAggregateDto {
  @ApiProperty({ example: 12 })
  total!: number;

  @ApiProperty({ example: 10 })
  active!: number;

  @ApiProperty({ type: () => [UserResponseDto] })
  list!: UserResponseDto[];
}

export class DashboardMarketPriceDto {
  @ApiProperty({ example: '68432.10' })
  price!: string;

  @ApiProperty({ example: '2026-04-01T10:00:30.000Z' })
  cachedAt!: string;
}

export class DashboardMarketAggregateDto {
  @ApiProperty({ type: () => DashboardMarketPriceDto })
  BTCUSDT!: DashboardMarketPriceDto;

  @ApiProperty({ type: () => DashboardMarketPriceDto })
  ETHUSDT!: DashboardMarketPriceDto;
}

export class DashboardAggregateDto {
  @ApiProperty({ type: () => DashboardUsersAggregateDto })
  users!: DashboardUsersAggregateDto;

  @ApiProperty({ type: () => DashboardMarketAggregateDto })
  market!: DashboardMarketAggregateDto;
}
