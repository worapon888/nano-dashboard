import type {
  CartesianChartSeries,
  ChartWidgetConfig,
  PieChartSeries,
} from '../../../types/widget'

const createSeries = (series: CartesianChartSeries[]): CartesianChartSeries[] => series

const createPieSeries = (series: PieChartSeries[]): PieChartSeries[] => series

type CategoryValue = string | number

type CartesianPoint = {
  category: CategoryValue
  value: number
}

function toNumber(value: number | string) {
  return typeof value === 'number' ? value : Number(value)
}

function createCartesianWidgetData<T extends Record<string, string | number>>(
  rows: T[],
  categoryKey: keyof T,
  valueKey: keyof T,
) {
  const normalizedRows: CartesianPoint[] = rows.map((row) => ({
    category: row[categoryKey] as CategoryValue,
    value: toNumber(row[valueKey] as string | number),
  }))

  const categories = normalizedRows.map((row) => String(row.category))
  const data = normalizedRows.map((row) => row.value)

  if (categories.length !== data.length) {
    throw new Error('Chart mock categories and data length must match')
  }

  if (data.some((value) => Number.isNaN(value))) {
    throw new Error('Chart mock data must contain only numeric values')
  }

  return {
    categories,
    series: createSeries([
      {
        name: String(valueKey),
        data,
      },
    ]),
  }
}

const volumeProfileRows = [
  { price: '68,400', volume: 84 },
  { price: '68,200', volume: 126 },
  { price: '68,000', volume: 172 },
  { price: '67,800', volume: 214 },
  { price: '67,600', volume: 181 },
  { price: '67,400', volume: 133 },
  { price: '67,200', volume: 92 },
]

const dailyPnlRows = [
  { day: 'Mon', pnl: 540 },
  { day: 'Tue', pnl: -220 },
  { day: 'Wed', pnl: 310 },
  { day: 'Thu', pnl: 680 },
  { day: 'Fri', pnl: -140 },
  { day: 'Sat', pnl: 190 },
  { day: 'Sun', pnl: 420 },
]

const volumeProfileChartData = createCartesianWidgetData(
  volumeProfileRows,
  'price',
  'volume',
)

const dailyPnlChartData = createCartesianWidgetData(dailyPnlRows, 'day', 'pnl')

export const chartWidgetsMock: ChartWidgetConfig[] = [
  {
    id: 'btc-price-trend',
    title: 'BTC Price Trend',
    chartType: 'line',
    categories: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'],
    series: createSeries([
      {
        name: 'BTC/USDT',
        data: [67240, 67480, 67190, 67620, 67910, 67780, 68140],
      },
    ]),
  },
  {
    id: 'volume-profile',
    title: 'Volume Profile',
    chartType: 'bar',
    categories: volumeProfileChartData.categories,
    series: createSeries([
      {
        name: 'Volume',
        data: volumeProfileChartData.series[0].data,
      },
    ]),
  },
  {
    id: 'daily-pnl',
    title: 'Daily PNL',
    chartType: 'column',
    categories: dailyPnlChartData.categories,
    series: createSeries([
      {
        name: 'PNL',
        data: dailyPnlChartData.series[0].data,
      },
    ]),
  },
  {
    id: 'portfolio-breakdown',
    title: 'Portfolio Breakdown',
    chartType: 'pie',
    series: createPieSeries([
      { name: 'BTC', value: 42 },
      { name: 'ETH', value: 28 },
      { name: 'SOL', value: 14 },
      { name: 'USDT', value: 10 },
      { name: 'Other', value: 6 },
    ]),
  },
]
