import { chartWidgetsMock } from '../../chart/data/chartWidgets.mock'
import { tableWidgetsMock } from '../../table/data/tableWidgets.mock'
import {
  buildWidgetRegistry,
  type DashboardDefinition,
} from '../lib/dashboardLayout'

const widgets = [...chartWidgetsMock, ...tableWidgetsMock]

export const tradingDashboardDefinition: DashboardDefinition = {
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
