import type { TableWidgetConfig } from '../../../types/widget'
import { ordersMock } from './orders.mock'

export const tableWidgetsMock: TableWidgetConfig[] = [
  {
    id: 'open-orders',
    title: 'Open Orders',
    widgetType: 'table',
    rows: ordersMock,
  },
]
