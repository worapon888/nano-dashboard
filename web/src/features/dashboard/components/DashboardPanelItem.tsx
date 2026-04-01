import type { AnyWidgetConfig, ChartWidgetConfig, TableWidgetConfig } from '../../../shared/types/widget'
import type { ResizeDirection } from '../../../shared/types/resize'
import TradingTable from '../../table/components/TradingTable'
import ChartWidget from '../../chart/components/ChartWidget'
import useWidgetDrag from '../hooks/useWidgetDrag'
import useWidgetResize from '../hooks/useWidgetResize'
import type { PanelRect } from '../lib/dashboardLayout'

type DashboardPanelItemProps = {
  panel: PanelRect
  widget: AnyWidgetConfig
  canvasWidth: number
  isDragging: boolean
  isResizing: boolean
  isAnimating: boolean
  canDrag: boolean
  canResize: boolean
  onDragStart: (panelId: string) => void
  onDrag: (panelId: string, deltaX: number, deltaY: number) => void
  onDragEnd: () => void
  onResizeStart: (panelId: string, direction: ResizeDirection) => void
  onResize: (panelId: string, direction: ResizeDirection, deltaX: number, deltaY: number) => void
  onResizeEnd: () => void
  onResetToDefault: (panelId: string) => void
  onMinimizeToggle: (panelId: string) => void
  onMaximizeToggle: (panelId: string) => void
}

function isTableWidget(widget: AnyWidgetConfig): widget is TableWidgetConfig {
  return (widget as TableWidgetConfig).widgetType === 'table'
}

function DashboardPanelItem({
  panel,
  widget,
  canvasWidth,
  isDragging,
  isResizing,
  isAnimating,
  canDrag,
  canResize,
  onDragStart,
  onDrag,
  onDragEnd,
  onResizeStart,
  onResize,
  onResizeEnd,
  onResetToDefault,
  onMinimizeToggle,
  onMaximizeToggle,
}: DashboardPanelItemProps) {
  const { isDragging: dragActive, onDragPointerDown } = useWidgetDrag({
    onDragStart: () => onDragStart(panel.id),
    onDrag: (deltaX, deltaY) => onDrag(panel.id, deltaX, deltaY),
    onDragEnd,
  })
  const { isResizing: resizeActive, onResizeHandlePointerDown } = useWidgetResize({
    onResizeStart: (direction) => onResizeStart(panel.id, direction),
    onResize: (direction, deltaX, deltaY) => onResize(panel.id, direction, deltaX, deltaY),
    onResizeEnd,
  })

  const sharedWidgetProps = {
    title: widget.title,
    isMinimized: panel.windowState === 'minimized',
    isMaximized: panel.windowState === 'maximized',
    isDragging: isDragging || dragActive,
    isResizing: isResizing || resizeActive,
    onDragPointerDown: canDrag ? onDragPointerDown : undefined,
    onResizeHandlePointerDown: canResize ? onResizeHandlePointerDown : undefined,
    onResetToDefault: () => onResetToDefault(panel.id),
    onMinimizeToggle: () => onMinimizeToggle(panel.id),
    onMaximizeToggle: () => onMaximizeToggle(panel.id),
  }

  return (
    <div
      className="pointer-events-auto absolute will-change-[left,top,width,height,transform,opacity]"
      style={{
        left: panel.x,
        top: panel.y,
        width: panel.width,
        height: panel.height,
        maxWidth: canvasWidth,
        opacity: panel.windowState === 'minimized' ? 0.96 : 1,
        transform: `scale(${panel.windowState === 'minimized' ? 0.985 : 1})`,
        transition:
          isDragging || isResizing
            ? 'none'
            : isAnimating
              ? 'left 420ms cubic-bezier(0.22, 1, 0.36, 1), top 420ms cubic-bezier(0.22, 1, 0.36, 1), width 420ms cubic-bezier(0.22, 1, 0.36, 1), height 420ms cubic-bezier(0.22, 1, 0.36, 1), transform 420ms cubic-bezier(0.22, 1, 0.36, 1), opacity 420ms cubic-bezier(0.22, 1, 0.36, 1)'
              : 'none',
      }}
    >
      {isTableWidget(widget) ? (
        <TradingTable
          {...sharedWidgetProps}
          data={widget.data}
          loading={widget.loading}
          error={widget.error}
        />
      ) : (
        <ChartWidget
          {...sharedWidgetProps}
          widgetId={widget.id}
          chartType={(widget as ChartWidgetConfig).chartType}
          series={(widget as ChartWidgetConfig).series}
          categories={(widget as ChartWidgetConfig).categories}
          presentation={(widget as ChartWidgetConfig).presentation}
        />
      )}
    </div>
  )
}

export default DashboardPanelItem
