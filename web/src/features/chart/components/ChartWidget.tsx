import type { PointerEvent as ReactPointerEvent } from 'react'
import type {
  ChartSeries,
  ChartType,
  ChartWidgetPresentation,
} from '../../../shared/types/widget'
import type { ResizeDirection } from '../../../shared/types/resize'
import ChartRenderer from './ChartRenderer'
import ChartStateNotice from './ChartStateNotice'
import ChartVariantLayout from './ChartVariantLayout'
import ChartWidgetChrome from './ChartWidgetChrome'
import { useChartWidgetViewModel } from '../lib/chartWidgetModel'

type ChartWidgetProps = {
  widgetId: string
  title: string
  chartType: ChartType
  series: ChartSeries[]
  categories?: string[]
  presentation?: ChartWidgetPresentation
  isMinimized?: boolean
  isMaximized?: boolean
  isDragging?: boolean
  isResizing?: boolean
  onDragPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void
  onResizeHandlePointerDown?: (
    direction: ResizeDirection,
    event: ReactPointerEvent<HTMLElement>,
  ) => void
  onResetToDefault?: () => void
  onMinimizeToggle?: () => void
  onMaximizeToggle?: () => void
}

function ChartWidget({
  widgetId,
  title,
  chartType,
  series,
  categories,
  presentation,
  isMinimized = false,
  isMaximized = false,
  isDragging = false,
  isResizing = false,
  onDragPointerDown,
  onResizeHandlePointerDown,
  onResetToDefault,
  onMinimizeToggle,
  onMaximizeToggle,
}: ChartWidgetProps) {
  const viewModel = useChartWidgetViewModel({
    widgetId,
    chartType,
    series,
    categories,
    presentation,
  })

  const stopHeaderPointerEvent = (event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }

  if (viewModel.state === 'error') {
    return (
      <ChartStateNotice
        title={title}
        tone="error"
        heading="Chart unavailable"
        description="This widget could not render because its chart data does not match the configured chart type."
      />
    )
  }

  if (viewModel.state === 'empty') {
    return (
      <ChartStateNotice
        title={title}
        tone="empty"
        heading="No chart data"
        description="This widget is ready, but there is no data available for the selected chart yet."
      />
    )
  }

  if (!viewModel.normalizedChart || !viewModel.chartOptions) {
    return null
  }

  return (
    <ChartWidgetChrome
      title={title}
      isMinimized={isMinimized}
      isMaximized={isMaximized}
      isDragging={isDragging}
      isResizing={isResizing}
      onDragPointerDown={onDragPointerDown}
      onResizeHandlePointerDown={onResizeHandlePointerDown}
      onResetToDefault={onResetToDefault}
      onMinimizeToggle={onMinimizeToggle}
      onMaximizeToggle={onMaximizeToggle}
      onControlPointerDown={stopHeaderPointerEvent}
    >
      {!isMinimized ? (
        <ChartVariantLayout
          chartType={chartType}
          variantFlags={viewModel.variantFlags}
          lineMetrics={viewModel.lineMetrics}
          dailyPnlMetrics={viewModel.dailyPnlMetrics}
          rangeLabels={viewModel.rangeLabels}
          onControlPointerDown={stopHeaderPointerEvent}
        >
          <ChartRenderer
            chartType={viewModel.normalizedChart.apexType}
            chartSeries={viewModel.normalizedChart.apexSeries}
            chartOptions={viewModel.chartOptions}
          />
        </ChartVariantLayout>
      ) : null}
    </ChartWidgetChrome>
  )
}

export default ChartWidget
