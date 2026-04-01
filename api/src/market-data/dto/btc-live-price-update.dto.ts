import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BtcLivePriceUpdateDto {
  @ApiProperty({ example: 'BTCUSDT' })
  symbol!: 'BTCUSDT';

  @ApiProperty({ example: 68432.1 })
  price!: number;

  @ApiPropertyOptional({ example: 1780 })
  change24h?: number;

  @ApiPropertyOptional({ example: 2.67 })
  change24hPercent?: number;

  @ApiPropertyOptional({ example: 69310 })
  high24h?: number;

  @ApiPropertyOptional({ example: 66427.53 })
  low24h?: number;

  @ApiProperty({ example: '2026-04-01T10:00:30.000Z' })
  updatedAt!: string;
}
