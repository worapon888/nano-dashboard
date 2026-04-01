import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardTopMoverDto {
  @ApiProperty({ example: 'BTCUSDT' })
  symbol!: string;
  @ApiProperty({ example: '68432.10' })
  price!: string;
  @ApiPropertyOptional({ example: '23100.50', nullable: true })
  volume24h!: string | null;
  @ApiPropertyOptional({ example: '1780.00', nullable: true })
  priceChange24h!: string | null;
  @ApiPropertyOptional({ example: '69310.00', nullable: true })
  high24h!: string | null;
  @ApiPropertyOptional({ example: '66427.53', nullable: true })
  low24h!: string | null;
  @ApiProperty({ example: '2026-04-01T10:00:30.000Z' })
  fetchedAt!: string;
}

export class DashboardHealthDto {
  @ApiProperty({ enum: ['up', 'down', 'unknown'], example: 'up' })
  db!: 'up' | 'down' | 'unknown';
  @ApiProperty({ enum: ['up', 'down', 'unknown'], example: 'up' })
  redis!: 'up' | 'down' | 'unknown';
  @ApiProperty({ example: 3, nullable: true })
  wsConnections!: number | null;
}

export class DashboardMarketOverviewDto {
  @ApiProperty({ example: 52.31 })
  btcDominance!: number;
  @ApiProperty({ example: 86 })
  fearGreedIndex!: number;
}

export class MarketShareItemDto {
  @ApiProperty({ example: 'BTC' })
  symbol!: string;
  @ApiProperty({ example: 52.31 })
  dominance!: number;
}

export class DashboardBtcPriceTrendDto {
  @ApiProperty({ enum: ['15m', '1h', '4h', '1d'], example: '1h' })
  range!: '15m' | '1h' | '4h' | '1d';
  @ApiProperty({ example: 'USD' })
  currency!: 'USD';
  @ApiProperty({ example: 68556 })
  livePrice!: number;
  @ApiProperty({ example: 1748 })
  change24h!: number;
  @ApiProperty({ example: 2.62 })
  change24hPercent!: number;
  @ApiProperty({ example: ['10:00', '11:00', '12:00'] })
  labels!: string[];
  @ApiProperty({ example: [68100, 68320, 68556] })
  series!: number[];
  @ApiProperty({ example: 69310 })
  high!: number;
  @ApiProperty({ example: 66427.53 })
  low!: number;
  @ApiProperty({ example: '2026-04-01T10:00:30.000Z' })
  updatedAt!: string;
}

export class DashboardVolumeProfileDto {
  @ApiProperty({ enum: ['15m', '1h', '4h', '1d'], example: '1h' })
  timeframe!: '15m' | '1h' | '4h' | '1d';
  @ApiProperty({ example: ['09:00', '10:00', '11:00'] })
  labels!: string[];
  @ApiProperty({ example: [12000, 18000, 25582] })
  volume!: number[];
  @ApiProperty({ example: ['#00E6A7', '#0EA5E9', '#FACC15'] })
  colors!: string[];
  @ApiProperty({ example: '2026-04-01T10:00:30.000Z' })
  updatedAt!: string;
}

export class DashboardDailyPnlPointDto {
  @ApiProperty({ example: 'Mon' })
  day!: string;
  @ApiProperty({ example: 480 })
  value!: number;
}

export class DashboardDailyPnlStatsDto {
  @ApiProperty({ example: 820 })
  best!: number;
  @ApiProperty({ example: -140 })
  worst!: number;
  @ApiProperty({ example: 255 })
  avg!: number;
  @ApiProperty({ example: 5 })
  win!: number;
  @ApiProperty({ example: 2 })
  loss!: number;
}

export class DashboardDailyPnlDto {
  @ApiProperty({ enum: ['week', 'month', 'year'], example: 'week' })
  range!: 'week' | 'month' | 'year';
  @ApiProperty({ example: 1780 })
  weeklyNet!: number;
  @ApiProperty({ type: () => [DashboardDailyPnlPointDto] })
  series!: DashboardDailyPnlPointDto[];
  @ApiProperty({ type: () => DashboardDailyPnlStatsDto })
  stats!: DashboardDailyPnlStatsDto;
  @ApiProperty({ example: '2026-04-01T10:00:30.000Z' })
  updatedAt!: string;
}

export class DashboardOpenOrderItemDto {
  @ApiProperty({ example: 'ord_001' })
  id!: string;
  @ApiProperty({ example: 'BTC/USDT' })
  pair!: string;
  @ApiProperty({ enum: ['BUY', 'SELL'], example: 'BUY' })
  side!: 'BUY' | 'SELL';
  @ApiProperty({ enum: ['Limit', 'Market', 'Stop', 'TP'], example: 'Limit' })
  type!: 'Limit' | 'Market' | 'Stop' | 'TP';
  @ApiProperty({ example: 68250 })
  price!: number;
  @ApiProperty({ example: 0.45 })
  amount!: number;
  @ApiProperty({ example: 62 })
  filledPercent!: number;
  @ApiProperty({ example: 30712.5 })
  totalUsd!: number;
  @ApiProperty({ enum: ['Open', 'Partial', 'Filled', 'Cancelled'], example: 'Partial' })
  status!: 'Open' | 'Partial' | 'Filled' | 'Cancelled';
  @ApiProperty({ example: 'Apr 1, 10:00' })
  createdAtLabel!: string;
}

export class DashboardOpenOrdersDto {
  @ApiProperty({ example: 3 })
  activeCount!: number;
  @ApiProperty({ example: 5 })
  totalCount!: number;
  @ApiProperty({ type: () => [DashboardOpenOrderItemDto] })
  items!: DashboardOpenOrderItemDto[];
  @ApiProperty({ example: '2026-04-01T10:00:30.000Z' })
  updatedAt!: string;
}

export class DashboardSummaryDto {
  @ApiProperty({ example: 2, nullable: true })
  userCount!: number | null;
  @ApiProperty({ type: () => [DashboardTopMoverDto] })
  topMovers!: DashboardTopMoverDto[];
  @ApiProperty({ type: () => DashboardMarketOverviewDto })
  marketOverview!: DashboardMarketOverviewDto;
  @ApiProperty({ type: () => [MarketShareItemDto] })
  marketShare!: MarketShareItemDto[];
  @ApiProperty({ type: () => DashboardBtcPriceTrendDto })
  btcPriceTrend!: DashboardBtcPriceTrendDto;
  @ApiProperty({ type: () => DashboardVolumeProfileDto })
  volumeProfile!: DashboardVolumeProfileDto;
  @ApiProperty({ type: () => DashboardDailyPnlDto })
  dailyPnl!: DashboardDailyPnlDto;
  @ApiProperty({ type: () => DashboardOpenOrdersDto })
  openOrders!: DashboardOpenOrdersDto;
  @ApiProperty({ type: () => DashboardHealthDto })
  health!: DashboardHealthDto;
  @ApiProperty({ example: ['market_data_unavailable'] })
  warnings!: string[];
  @ApiPropertyOptional({ example: false })
  stale?: boolean;
  @ApiProperty({ example: '2026-04-01T10:00:30.000Z' })
  generatedAt!: string;
}
