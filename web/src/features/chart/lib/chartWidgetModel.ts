import { useMemo } from 'react'
import type { ApexOptions } from 'apexcharts'
import type {
  CartesianChartSeries,
  ChartSeries,
  ChartType,
  ChartWidgetPresentation,
  PieChartSeries,
} from '../../../shared/types/widget'
import { buildChartOptions, getApexChartType } from './chartOptions'

export type NormalizedChart = {
  apexType: 'area' | 'line' | 'bar' | 'pie'
  apexSeries: number[] | CartesianChartSeries[]
}

export type ChartVariantFlags = {
  isStockStyleLineChart: boolean
  isMarketTrendWidget: boolean
  isDailyPnlWidget: boolean
  isVolumeProfileWidget: boolean
  isPortfolioBreakdownWidget: boolean
}

export type LineTrendMetrics = {
  latestValue: number | null
  delta: number | null
  deltaPercent: number | null
  isPositive: boolean
  trendColorClass: string
  formattedChange: string
  formattedChangePercent: string
}

export type DailyPnlMetrics = {
  values: number[]
  total: number
  positiveDays: number
  negativeDays: number
  strongestValue: number | null
  weakestValue: number | null
  averageValue: number | null
}

export type ChartWidgetViewModel = {
  state: 'ready' | 'empty' | 'error'
  chartId: string
  chartOptions: ApexOptions | null
  normalizedChart: NormalizedChart | null
  rangeLabels: string[]
  variantFlags: ChartVariantFlags
  lineMetrics: LineTrendMetrics
  dailyPnlMetrics: DailyPnlMetrics
}

function isPieSeries(series: ChartSeries[]): series is PieChartSeries[] {
  return series.every((item) => 'value' in item)
}

function isCartesianSeries(series: ChartSeries[]): series is CartesianChartSeries[] {
  return series.every((item) => 'data' in item)
}

function isCartesianApexSeries(
  series: number[] | CartesianChartSeries[],
): series is CartesianChartSeries[] {
  return series.every((item) => typeof item === 'object' && item !== null && 'data' in item)
}

function getApexSeries(
  chartType: ChartType,
  series: ChartSeries[],
  presentation?: ChartWidgetPresentation,
): NormalizedChart | null {
  if (chartType === 'pie') {
    if (!isPieSeries(series)) {
      return null
    }

    return {
      apexType: 'pie',
      apexSeries: series.map((item) => item.value),
    }
  }

  if (!isCartesianSeries(series)) {
    return null
  }

  const apexSeries = series.map((item) => ({
    name: item.name,
    data: item.data,
  }))

  if (chartType === 'line') {
    return {
      apexType: getApexChartType(chartType, presentation),
      apexSeries,
    }
  }

  return {
    apexType: 'bar',
    apexSeries,
  }
}

function createVariantFlags(
  chartType: ChartType,
  presentation?: ChartWidgetPresentation,
): ChartVariantFlags {
  const variant = presentation?.variant ?? 'default'

  return {
    isStockStyleLineChart: chartType === 'line',
    isMarketTrendWidget: variant === 'market-trend',
    isDailyPnlWidget: variant === 'daily-pnl',
    isVolumeProfileWidget: variant === 'volume-profile',
    isPortfolioBreakdownWidget: variant === 'portfolio-breakdown',
  }
}

function createLineTrendMetrics(
  chartType: ChartType,
  normalizedChart: NormalizedChart | null,
): LineTrendMetrics {
  const primarySeries =
    chartType === 'line' &&
    normalizedChart &&
    normalizedChart.apexType !== 'pie' &&
    normalizedChart.apexSeries.length > 0
      ? (normalizedChart.apexSeries[0] as CartesianChartSeries)
      : null

  const latestValue =
    primarySeries && primarySeries.data.length > 0
      ? primarySeries.data[primarySeries.data.length - 1]
      : null
  const firstValue =
    primarySeries && primarySeries.data.length > 0 ? primarySeries.data[0] : null
  const delta =
    latestValue !== null && firstValue !== null ? latestValue - firstValue : null
  const deltaPercent =
    delta !== null && firstValue ? (delta / firstValue) * 100 : null
  const isPositive = delta !== null ? delta >= 0 : true

  return {
    latestValue,
    delta,
    deltaPercent,
    isPositive,
    trendColorClass: isPositive ? 'text-[#22C55E]' : 'text-[#ff7b7b]',
    formattedChange:
      delta !== null ? `${delta > 0 ? '+' : ''}${Math.round(delta).toLocaleString()}` : '--',
    formattedChangePercent:
      deltaPercent !== null
        ? `${deltaPercent > 0 ? '+' : ''}${deltaPercent.toFixed(2)}%`
        : '--',
  }
}

function createDailyPnlMetrics(
  variantFlags: ChartVariantFlags,
  normalizedChart: NormalizedChart | null,
): DailyPnlMetrics {
  const values =
    variantFlags.isDailyPnlWidget &&
    normalizedChart &&
    normalizedChart.apexType !== 'pie' &&
    normalizedChart.apexSeries.length > 0
      ? (normalizedChart.apexSeries[0] as CartesianChartSeries).data
      : []

  const total = values.reduce((sum, value) => sum + value, 0)

  return {
    values,
    total,
    positiveDays: values.filter((value) => value > 0).length,
    negativeDays: values.filter((value) => value < 0).length,
    strongestValue: values.length > 0 ? Math.max(...values) : null,
    weakestValue: values.length > 0 ? Math.min(...values) : null,
    averageValue: values.length > 0 ? total / values.length : null,
  }
}

function isEmptyChart(normalizedChart: NormalizedChart | null) {
  if (!normalizedChart) {
    return false
  }

  if (normalizedChart.apexType === 'pie') {
    return normalizedChart.apexSeries.length === 0
  }

  return (
    isCartesianApexSeries(normalizedChart.apexSeries) &&
    normalizedChart.apexSeries.length > 0 &&
    normalizedChart.apexSeries.every((item) => item.data.length === 0)
  )
}

export function createChartWidgetViewModel({
  widgetId,
  chartType,
  series,
  categories,
  presentation,
}: {
  widgetId: string
  chartType: ChartType
  series: ChartSeries[]
  categories?: string[]
  presentation?: ChartWidgetPresentation
}): ChartWidgetViewModel {
  const chartId = widgetId
  const variantFlags = createVariantFlags(chartType, presentation)
  const pieLabels = isPieSeries(series) ? series.map((item) => item.name) : undefined
  const normalizedChart = getApexSeries(chartType, series, presentation)
  const primaryCartesianValues =
    normalizedChart &&
    normalizedChart.apexType !== 'pie' &&
    normalizedChart.apexSeries.length > 0
      ? (normalizedChart.apexSeries[0] as CartesianChartSeries).data
      : undefined
  const chartOptions =
    normalizedChart &&
    normalizedChart.apexType === getApexChartType(chartType, presentation)
      ? buildChartOptions({
          chartId,
          chartType,
          presentation,
          categories,
          labels: pieLabels,
          values:
            variantFlags.isStockStyleLineChart ||
            variantFlags.isDailyPnlWidget ||
            variantFlags.isVolumeProfileWidget ||
            variantFlags.isPortfolioBreakdownWidget
              ? primaryCartesianValues ??
                (isPieSeries(series) ? series.map((item) => item.value) : undefined)
              : undefined,
        })
      : null

  const state =
    !normalizedChart || normalizedChart.apexType !== getApexChartType(chartType, presentation)
      ? 'error'
      : isEmptyChart(normalizedChart)
        ? 'empty'
        : 'ready'

  return {
    state,
    chartId,
    chartOptions,
    normalizedChart,
    rangeLabels: presentation?.rangeLabels ?? ['Day', 'Week', 'Month'],
    variantFlags,
    lineMetrics: createLineTrendMetrics(chartType, normalizedChart),
    dailyPnlMetrics: createDailyPnlMetrics(variantFlags, normalizedChart),
  }
}

export function useChartWidgetViewModel(input: {
  widgetId: string
  chartType: ChartType
  series: ChartSeries[]
  categories?: string[]
  presentation?: ChartWidgetPresentation
}) {
  return useMemo(
    () => createChartWidgetViewModel(input),
    [input.categories, input.chartType, input.presentation, input.series, input.widgetId],
  )
}
