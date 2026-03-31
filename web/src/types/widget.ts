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
