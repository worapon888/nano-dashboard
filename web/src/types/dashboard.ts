export type BtcTrendRange = '15m' | '1h' | '4h' | '1d'
export type DailyPnlRange = 'week' | 'month' | 'year'

export interface DashboardTopMover {
  symbol: string
  price: number
  priceChange24h: number
  volume24h: number
  high24h: number
  low24h: number
  fetchedAt: string
}

export interface DashboardMarketOverview {
  btcDominance: number
  fearGreedIndex: number
}

export interface MarketShareItem {
  symbol: string
  dominance: number
}

export interface BtcPriceTrend {
  range: BtcTrendRange
  currency: string
  livePrice: number
  change24h: number
  change24hPercent: number
  labels: string[]
  series: number[]
  high: number
  low: number
  updatedAt: string
}

export interface BtcLivePriceUpdate {
  symbol: 'BTCUSDT'
  price: number
  change24h?: number
  change24hPercent?: number
  high24h?: number
  low24h?: number
  updatedAt: string
}

export interface BtcLiveVolumeUpdate {
  symbol: 'BTCUSDT'
  timeframe: BtcTrendRange
  label: string
  volume: number
  color: string
  direction: 'bullish' | 'bearish'
  updatedAt: string
}

export interface RealtimeUserEvent {
  id: string
  email: string
  displayName: string
  role: string
  isActive: boolean
  createdAt: string
  updatedAt?: string
}

export interface DashboardVolumeProfile {
  timeframe: BtcTrendRange
  labels: string[]
  volume: number[]
  colors: string[]
  updatedAt: string
}

export interface DashboardDailyPnlPoint {
  day: string
  value: number
}

export interface DashboardDailyPnl {
  range: DailyPnlRange
  weeklyNet: number
  series: DashboardDailyPnlPoint[]
  stats: {
    best: number
    worst: number
    avg: number
    win: number
    loss: number
  }
  updatedAt: string
}

export interface OpenOrderItem {
  id: string
  pair: string
  side: 'BUY' | 'SELL'
  type: string
  price: number
  amount: number
  filledPercent: number
  totalUsd: number
  status: 'Open' | 'Partial' | 'Filled' | 'Cancelled'
  createdAtLabel: string
}

export interface OpenOrdersSummary {
  activeCount: number
  totalCount: number
  items: OpenOrderItem[]
  updatedAt: string
}

export interface DashboardSummaryData {
  userCount: number | null
  topMovers: DashboardTopMover[]
  marketOverview: DashboardMarketOverview
  marketShare: MarketShareItem[]
  btcPriceTrend?: BtcPriceTrend | null
  volumeProfile?: DashboardVolumeProfile | null
  dailyPnl?: DashboardDailyPnl | null
  openOrders?: OpenOrdersSummary | null
  health?: {
    db: string
    redis: string
    wsConnections: number
  }
  warnings?: string[]
  stale?: boolean
  generatedAt?: string
}

export interface DashboardSummaryResponse {
  success: true
  data: DashboardSummaryData
}
