export class DashboardTopMoverDto {
  symbol!: string;
  price!: string;
  volume24h!: string | null;
  priceChange24h!: string | null;
  high24h!: string | null;
  low24h!: string | null;
  fetchedAt!: string;
}

export class DashboardHealthDto {
  db!: 'up' | 'down' | 'unknown';
  redis!: 'up' | 'down' | 'unknown';
  wsConnections!: number | null;
}

export class DashboardMarketOverviewDto {
  btcDominance!: number;
  fearGreedIndex!: number;
}

export class MarketShareItemDto {
  symbol!: string;
  dominance!: number;
}

export class DashboardBtcPriceTrendDto {
  range!: '15m' | '1h' | '4h' | '1d';
  currency!: 'USD';
  livePrice!: number;
  change24h!: number;
  change24hPercent!: number;
  labels!: string[];
  series!: number[];
  high!: number;
  low!: number;
  updatedAt!: string;
}

export class DashboardVolumeProfileDto {
  timeframe!: '15m' | '1h' | '4h' | '1d';
  labels!: string[];
  volume!: number[];
  colors!: string[];
  updatedAt!: string;
}

export class DashboardDailyPnlPointDto {
  day!: string;
  value!: number;
}

export class DashboardDailyPnlStatsDto {
  best!: number;
  worst!: number;
  avg!: number;
  win!: number;
  loss!: number;
}

export class DashboardDailyPnlDto {
  range!: 'week' | 'month' | 'year';
  weeklyNet!: number;
  series!: DashboardDailyPnlPointDto[];
  stats!: DashboardDailyPnlStatsDto;
  updatedAt!: string;
}

export class DashboardOpenOrderItemDto {
  id!: string;
  pair!: string;
  side!: 'BUY' | 'SELL';
  type!: 'Limit' | 'Market' | 'Stop' | 'TP';
  price!: number;
  amount!: number;
  filledPercent!: number;
  totalUsd!: number;
  status!: 'Open' | 'Partial' | 'Filled' | 'Cancelled';
  createdAtLabel!: string;
}

export class DashboardOpenOrdersDto {
  activeCount!: number;
  totalCount!: number;
  items!: DashboardOpenOrderItemDto[];
  updatedAt!: string;
}

export class DashboardSummaryDto {
  userCount!: number | null;
  topMovers!: DashboardTopMoverDto[];
  marketOverview!: DashboardMarketOverviewDto;
  marketShare!: MarketShareItemDto[];
  btcPriceTrend!: DashboardBtcPriceTrendDto;
  volumeProfile!: DashboardVolumeProfileDto;
  dailyPnl!: DashboardDailyPnlDto;
  openOrders!: DashboardOpenOrdersDto;
  health!: DashboardHealthDto;
  warnings!: string[];
  stale?: boolean;
  generatedAt!: string;
}
