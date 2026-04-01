import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TickerDto {
  @ApiProperty({ example: 'BTCUSDT' })
  symbol!: string;
  @ApiProperty({ example: '68432.10' })
  price!: string;
  @ApiPropertyOptional({ example: '23100.50', nullable: true })
  volume24h!: string | null;
  @ApiPropertyOptional({ example: '1780.00', nullable: true })
  priceChange24h!: string | null;
  @ApiPropertyOptional({ example: '2.67', nullable: true })
  priceChange24hPercent!: string | null;
  @ApiPropertyOptional({ example: '69310.00', nullable: true })
  high24h!: string | null;
  @ApiPropertyOptional({ example: '66427.53', nullable: true })
  low24h!: string | null;
  @ApiProperty({ example: '2026-04-01T10:00:30.000Z' })
  fetchedAt!: string;
  @ApiProperty({ example: 'binance' })
  source!: string;
  @ApiPropertyOptional({ enum: ['fresh', 'hot', 'stale'], example: 'hot' })
  cacheSource?: 'fresh' | 'hot' | 'stale';
  @ApiPropertyOptional({ example: false })
  stale?: boolean;
}
