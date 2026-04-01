import { ApiProperty } from '@nestjs/swagger';

export class BtcLiveVolumeUpdateDto {
  @ApiProperty({ example: 'BTCUSDT' })
  symbol!: 'BTCUSDT';

  @ApiProperty({ enum: ['15m', '1h', '4h', '1d'], example: '1h' })
  timeframe!: '15m' | '1h' | '4h' | '1d';

  @ApiProperty({ example: '14:00' })
  label!: string;

  @ApiProperty({ example: 25582 })
  volume!: number;

  @ApiProperty({ example: '#00E6A7' })
  color!: string;

  @ApiProperty({ enum: ['bullish', 'bearish'], example: 'bullish' })
  direction!: 'bullish' | 'bearish';

  @ApiProperty({ example: '2026-04-01T10:00:30.000Z' })
  updatedAt!: string;
}
