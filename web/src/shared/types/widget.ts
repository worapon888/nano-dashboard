import type {
  BtcTrendRange,
  DailyPnlRange,
  OpenOrdersSummary,
} from '../../types/dashboard'

export type ChartType = 'line' | 'bar' | 'column' | 'pie'

export type CartesianChartSeries = {
  name: string
  data: number[]
}

export type PieChartSeries = {
  name: string
  value: number
}

export type ChartSeries = CartesianChartSeries | PieChartSeries

export type ChartWidgetVariant =
  | 'default'
  | 'market-trend'
  | 'volume-profile'
  | 'daily-pnl'
  | 'portfolio-breakdown'

export type ChartWidgetPresentation = {
  variant?: ChartWidgetVariant
  rangeLabels?: string[]
  marketTrendData?: {
    livePrice: number
    change24h: number
    change24hPercent: number
    high: number
    low: number
    updatedAt: string
  } | null
  marketTrendControls?: {
    selectedRange: BtcTrendRange
    onRangeChange?: (range: BtcTrendRange) => void
    isUpdating?: boolean
    liveStatus?: 'connecting' | 'live' | 'offline'
  } | null
  volumeProfileData?: {
    timeframe: BtcTrendRange
    colors: string[]
    directions?: ('bullish' | 'bearish')[]
    totalVolume?: number
    updatedAt: string
  } | null
  dailyPnlData?: {
    range: DailyPnlRange
    weeklyNet: number
    best: number
    worst: number
    avg: number
    win: number
    loss: number
    updatedAt: string
  } | null
  volumeProfileControls?: {
    selectedTimeframe: BtcTrendRange
    onTimeframeChange?: (range: BtcTrendRange) => void
    isUpdating?: boolean
  } | null
  dailyPnlControls?: {
    selectedRange: DailyPnlRange
    onRangeChange?: (range: DailyPnlRange) => void
    isUpdating?: boolean
  } | null
}

export type ChartWidgetConfig = {
  id: string
  title: string
  chartType: ChartType
  series: ChartSeries[]
  categories?: string[]
  presentation?: ChartWidgetPresentation
}

export type TableWidgetConfig = {
  id: string
  title: string
  widgetType: 'table'
  data?: OpenOrdersSummary | null
  loading?: boolean
  error?: string | null
}

export type AnyWidgetConfig = ChartWidgetConfig | TableWidgetConfig
