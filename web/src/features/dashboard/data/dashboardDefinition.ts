import type { ChartWidgetConfig } from '../../../shared/types/widget'
import type {
  BtcPriceTrend,
  BtcTrendRange,
  DashboardDailyPnl,
  OpenOrdersSummary,
  DashboardVolumeProfile,
  DailyPnlRange,
  MarketShareItem,
} from '../../../types/dashboard'
import {
  buildWidgetRegistry,
  type DashboardDefinition,
} from '../lib/dashboardLayout'

export type BtcPriceTrendWidgetProps = {
  trend: BtcPriceTrend | null
  selectedRange: BtcTrendRange
  onRangeChange: (range: BtcTrendRange) => void
  liveStatus?: 'connecting' | 'live' | 'offline'
  loading?: boolean
  error?: string | null
}

export type MarketShareBreakdownWidgetProps = {
  series: number[]
  labels: string[]
  items?: MarketShareItem[]
}

export type VolumeProfileWidgetProps = {
  data: DashboardVolumeProfile | null
  selectedTimeframe: BtcTrendRange
  onTimeframeChange: (range: BtcTrendRange) => void
  loading?: boolean
}

export type DailyPnlWidgetProps = {
  data: DashboardDailyPnl | null
  selectedRange: DailyPnlRange
  onRangeChange: (range: DailyPnlRange) => void
  loading?: boolean
}

export type OpenOrdersWidgetProps = {
  data: OpenOrdersSummary | null
  loading?: boolean
  error?: string | null
}

function createBtcPriceTrendWidget({
  trend,
  selectedRange,
  onRangeChange,
  liveStatus,
  loading,
}: BtcPriceTrendWidgetProps): ChartWidgetConfig {
  const labels =
    trend &&
    Array.isArray(trend.labels) &&
    Array.isArray(trend.series) &&
    trend.labels.length > 0 &&
    trend.labels.length === trend.series.length
      ? trend.labels
      : []
  const seriesData =
    labels.length > 0 && trend
      ? trend.series.filter((value) => typeof value === 'number' && Number.isFinite(value))
      : []
  const pointCount = Math.min(labels.length, seriesData.length)

  return {
    id: 'btc-price-trend',
    title: 'BTC Price Trend',
    chartType: 'line',
    categories: labels.slice(0, pointCount),
    presentation: {
      variant: 'market-trend',
      rangeLabels: ['15m', '1h', '4h', '1d'],
      marketTrendData: trend
        ? {
            livePrice: trend.livePrice,
            change24h: trend.change24h,
            change24hPercent: trend.change24hPercent,
            high: trend.high,
            low: trend.low,
            updatedAt: trend.updatedAt,
          }
        : null,
      marketTrendControls: {
        selectedRange,
        onRangeChange,
        isUpdating: loading ?? false,
        liveStatus: liveStatus ?? 'offline',
      },
    },
    series: [
      {
        name: 'BTC/USDT',
        data: seriesData.slice(0, pointCount),
      },
    ],
  }
}

function createPortfolioBreakdownWidget({
  series,
  labels,
}: MarketShareBreakdownWidgetProps): ChartWidgetConfig {
  return {
    id: 'portfolio-breakdown',
    title: 'Market Share Breakdown',
    chartType: 'pie',
    presentation: {
      variant: 'portfolio-breakdown',
    },
    series: labels.map((label, index) => ({
      name: label,
      value: series[index] ?? 0,
    })),
  }
}

function createVolumeProfileWidget({
  data,
  selectedTimeframe,
  onTimeframeChange,
  loading,
}: VolumeProfileWidgetProps): ChartWidgetConfig {
  const hasValidData =
    data &&
    Array.isArray(data.labels) &&
    Array.isArray(data.volume) &&
    Array.isArray(data.colors) &&
    data.labels.length > 0 &&
    data.labels.length === data.volume.length &&
    data.labels.length === data.colors.length
  const pointCount = hasValidData
    ? Math.min(data.labels.length, data.volume.length, data.colors.length)
    : 0
  const totalVolume = hasValidData
    ? data.volume.slice(0, pointCount).reduce((sum, value) => sum + value, 0)
    : 0

  return {
    id: 'volume-profile',
    title: 'Volume Profile',
    chartType: 'bar',
    categories: hasValidData ? data.labels.slice(0, pointCount) : [],
    presentation: {
      variant: 'volume-profile',
      rangeLabels: ['15m', '1h', '4h', '1d'],
      volumeProfileData: data
        ? {
            timeframe: data.timeframe,
            colors: hasValidData ? data.colors.slice(0, pointCount) : [],
            directions: hasValidData
              ? data.colors.slice(0, pointCount).map((color) =>
                  color.toLowerCase() === '#22c55e' ? 'bullish' : 'bearish',
                )
              : [],
            totalVolume,
            updatedAt: data.updatedAt,
          }
        : null,
      volumeProfileControls: {
        selectedTimeframe,
        onTimeframeChange,
        isUpdating: loading ?? false,
      },
    },
    series: [
      {
        name: 'Volume',
        data: hasValidData ? data.volume.slice(0, pointCount) : [],
      },
    ],
  }
}

function createDailyPnlWidget({
  data,
  selectedRange,
  onRangeChange,
  loading,
}: DailyPnlWidgetProps): ChartWidgetConfig {
  const hasValidData =
    data &&
    Array.isArray(data.series) &&
    data.series.length > 0 &&
    data.series.every(
      (item) =>
        typeof item.day === 'string' &&
        typeof item.value === 'number' &&
        Number.isFinite(item.value),
    )

  const categories = hasValidData ? data.series.map((item) => item.day) : []
  const seriesData = hasValidData ? data.series.map((item) => item.value) : []

  return {
    id: 'daily-pnl',
    title: 'Daily PNL',
    chartType: 'column',
    categories,
    presentation: {
      variant: 'daily-pnl',
      dailyPnlData: data
        ? {
            range: data.range,
            weeklyNet: data.weeklyNet,
            best: data.stats.best,
            worst: data.stats.worst,
            avg: data.stats.avg,
            win: data.stats.win,
            loss: data.stats.loss,
            updatedAt: data.updatedAt,
          }
        : null,
      dailyPnlControls: {
        selectedRange,
        onRangeChange,
        isUpdating: loading ?? false,
      },
    },
    series: [
      {
        name: 'PNL',
        data: seriesData,
      },
    ],
  }
}

function createOpenOrdersWidget({
  data,
  loading,
  error,
}: OpenOrdersWidgetProps) {
  return {
    id: 'open-orders',
    title: 'Open Orders',
    widgetType: 'table' as const,
    data,
    loading: loading ?? false,
    error: error ?? null,
  }
}

export function createTradingDashboardDefinition(
  {
    btcPriceTrendWidget,
    volumeProfileWidget,
    dailyPnlWidget,
    openOrdersWidget,
    marketShareWidget,
  }: {
    btcPriceTrendWidget: BtcPriceTrendWidgetProps
    volumeProfileWidget: VolumeProfileWidgetProps
    dailyPnlWidget: DailyPnlWidgetProps
    openOrdersWidget: OpenOrdersWidgetProps
    marketShareWidget: MarketShareBreakdownWidgetProps
  },
): DashboardDefinition {
  const widgets = [
    createBtcPriceTrendWidget(btcPriceTrendWidget),
    createVolumeProfileWidget(volumeProfileWidget),
    createDailyPnlWidget(dailyPnlWidget),
    createPortfolioBreakdownWidget(marketShareWidget),
    createOpenOrdersWidget(openOrdersWidget),
  ]

  return {
    id: 'trading-dashboard',
    widgetRegistry: buildWidgetRegistry(widgets),
    layout: [
      { widgetId: 'btc-price-trend', x: 0, y: 0, w: 8, h: 5, minWidth: 360, minHeight: 320 },
      { widgetId: 'portfolio-breakdown', x: 8, y: 0, w: 4, h: 5, minWidth: 320, minHeight: 320 },
      { widgetId: 'volume-profile', x: 0, y: 5, w: 4, h: 5, minWidth: 320, minHeight: 300 },
      { widgetId: 'daily-pnl', x: 4, y: 5, w: 8, h: 5, minWidth: 360, minHeight: 300 },
      { widgetId: 'open-orders', x: 0, y: 10, w: 12, h: 6, minWidth: 720, minHeight: 340 },
    ],
  }
}

export const tradingDashboardDefinition = createTradingDashboardDefinition({
    btcPriceTrendWidget: {
      trend: null,
      selectedRange: '1h',
      onRangeChange: () => undefined,
      liveStatus: 'offline',
    },
  volumeProfileWidget: {
    data: null,
    selectedTimeframe: '1h',
    onTimeframeChange: () => undefined,
  },
  dailyPnlWidget: {
    data: null,
    selectedRange: 'week',
    onRangeChange: () => undefined,
  },
  openOrdersWidget: {
    data: null,
  },
  marketShareWidget: {
    series: [],
    labels: [],
  },
})
