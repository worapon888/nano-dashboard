export type DashboardPanel = {
  id: string
  x: number
  y: number
  w: number
  h: number
  title: string
  widgetType?: 'chart' | 'table'
  chartType?: 'line' | 'bar' | 'column' | 'pie'
}

export const dashboardPanelsMock: DashboardPanel[] = [
  {
    id: 'btc-price-trend',
    x: 0,
    y: 0,
    w: 6,
    h: 5,
    title: 'BTC Price Trend',
    widgetType: 'chart',
    chartType: 'line',
  },
  {
    id: 'volume-profile',
    x: 6,
    y: 0,
    w: 6,
    h: 5,
    title: 'Volume Profile',
    widgetType: 'chart',
    chartType: 'bar',
  },
  {
    id: 'daily-pnl',
    x: 0,
    y: 5,
    w: 7,
    h: 5,
    title: 'Daily PNL',
    widgetType: 'chart',
    chartType: 'column',
  },
  {
    id: 'portfolio-breakdown',
    x: 7,
    y: 5,
    w: 5,
    h: 5,
    title: 'Portfolio Breakdown',
    widgetType: 'chart',
    chartType: 'pie',
  },
  {
    id: 'open-orders',
    x: 0,
    y: 10,
    w: 12,
    h: 6,
    title: 'Open Orders',
    widgetType: 'table',
  },
]
