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

export type ChartWidgetConfig = {
  id: string
  title: string
  chartType: ChartType
  series: ChartSeries[]
  categories?: string[]
}

// ─── Table widget types ──────────────────────────────────────────────────────

export type OrderSide = 'buy' | 'sell'

export type OrderType = 'market' | 'limit' | 'stop-limit' | 'take-profit'

export type OrderStatus = 'open' | 'partial' | 'filled' | 'cancelled'

export type OrderRow = {
  id: string
  symbol: string
  side: OrderSide
  type: OrderType
  price: number
  stopPrice?: number
  amount: number
  filled: number
  filledPct: number
  total: number
  fee: number
  averagePrice: number
  status: OrderStatus
  createdAt: string
  updatedAt: string
  notes?: string
}

export type TableWidgetConfig = {
  id: string
  title: string
  widgetType: 'table'
  rows: OrderRow[]
}

export type AnyWidgetConfig = ChartWidgetConfig | TableWidgetConfig
