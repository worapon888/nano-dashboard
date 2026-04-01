import { ReactLenis } from 'lenis/react'
import useResizeObserver from '../../../shared/hooks/useResizeObserver'
import DashboardPanelItem from './DashboardPanelItem'
import { useDashboardLayoutController } from '../hooks/useDashboardLayoutController'
import type { DashboardDefinition, PanelRect } from '../lib/dashboardLayout'

type DashboardGridProps = {
  definition: DashboardDefinition
  resetRequestId?: number
  autoArrangeRequestId?: number
}

const dashboardLenisOptions = {
  autoRaf: true,
  duration: 1.3,
  smoothWheel: true,
  wheelMultiplier: 0.9,
  syncTouch: true,
  touchMultiplier: 1,
  gestureOrientation: 'vertical' as const,
}

type DashboardPanelLayerProps = {
  panels: PanelRect[]
  canvasWidth: number
  positionMode?: 'absolute' | 'static'
  isDragging: (panelId: string) => boolean
  isResizing: (panelId: string) => boolean
  isAnimating: (panelId: string) => boolean
  canDrag: (panel: PanelRect) => boolean
  canResize: (panel: PanelRect) => boolean
  getWidget: (panelId: string) => DashboardDefinition['widgetRegistry'][string] | undefined
  onDragStart: (panelId: string) => void
  onDrag: (panelId: string, deltaX: number, deltaY: number) => void
  onDragEnd: () => void
  onResizeStart: (panelId: string, direction: import('../../../shared/types/resize').ResizeDirection) => void
  onResize: (panelId: string, direction: import('../../../shared/types/resize').ResizeDirection, deltaX: number, deltaY: number) => void
  onResizeEnd: () => void
  onResetToDefault: (panelId: string) => void
  onMinimizeToggle: (panelId: string) => void
  onMaximizeToggle: (panelId: string) => void
}

function DashboardPanelLayer({
  panels,
  canvasWidth,
  positionMode = 'absolute',
  isDragging,
  isResizing,
  isAnimating,
  canDrag,
  canResize,
  getWidget,
  onDragStart,
  onDrag,
  onDragEnd,
  onResizeStart,
  onResize,
  onResizeEnd,
  onResetToDefault,
  onMinimizeToggle,
  onMaximizeToggle,
}: DashboardPanelLayerProps) {
  return (
    <>
      {panels.map((panel) => {
        const widget = getWidget(panel.id)

        if (!widget) {
          return null
        }

        return (
          <DashboardPanelItem
            key={panel.id}
            panel={panel}
            widget={widget}
            canvasWidth={canvasWidth}
            positionMode={positionMode}
            isDragging={isDragging(panel.id)}
            isResizing={isResizing(panel.id)}
            isAnimating={isAnimating(panel.id)}
            canDrag={canDrag(panel)}
            canResize={canResize(panel)}
            onDragStart={onDragStart}
            onDrag={onDrag}
            onDragEnd={onDragEnd}
            onResizeStart={onResizeStart}
            onResize={onResize}
            onResizeEnd={onResizeEnd}
            onResetToDefault={onResetToDefault}
            onMinimizeToggle={onMinimizeToggle}
            onMaximizeToggle={onMaximizeToggle}
          />
        )
      })}
    </>
  )
}

function DashboardGrid({
  definition,
  resetRequestId = 0,
  autoArrangeRequestId = 0,
}: DashboardGridProps) {
  const { ref: canvasRef, width: canvasWidth } = useResizeObserver<HTMLDivElement>()
  const controller = useDashboardLayoutController({
    definition,
    canvasWidth,
    resetRequestId,
    autoArrangeRequestId,
  })

  const getWidget = (panelId: string) => controller.widgetsById.get(panelId)
  const isDragging = (panelId: string) => controller.activeDragPanelId === panelId
  const isResizing = (panelId: string) => controller.activeResizePanelId === panelId
  const isAnimating = (panelId: string) => controller.animatedPanelIds.includes(panelId)
  const canDrag = (panel: PanelRect) => controller.isDesktopViewport && panel.windowState === 'normal'
  const canResize = (panel: PanelRect) => controller.isDesktopViewport && panel.windowState === 'normal'

  if (!controller.isDesktopViewport) {
    return (
      <div ref={canvasRef} className="w-full">
        <div className="flex flex-col gap-4 sm:gap-5">
          <DashboardPanelLayer
            panels={controller.canvasPanels}
            canvasWidth={controller.canvasWidth}
            positionMode="static"
            isDragging={isDragging}
            isResizing={isResizing}
            isAnimating={isAnimating}
            canDrag={canDrag}
            canResize={canResize}
            getWidget={getWidget}
            onDragStart={controller.handleDragStart}
            onDrag={controller.handleDrag}
            onDragEnd={controller.handleDragEnd}
            onResizeStart={controller.handleResizeStart}
            onResize={controller.handleResize}
            onResizeEnd={controller.handleResizeEnd}
            onResetToDefault={controller.handleResetToDefault}
            onMinimizeToggle={controller.handleMinimizeToggle}
            onMaximizeToggle={controller.handleMaximizeToggle}
          />
        </div>
      </div>
    )
  }

  return (
    <div ref={canvasRef} className="relative h-full min-h-0 w-full overflow-hidden">
      <ReactLenis
        className="h-full min-h-0 overflow-y-auto overflow-x-hidden"
        options={dashboardLenisOptions}
      >
        <div className="relative min-h-[42rem] w-full max-w-full" style={{ height: controller.canvasHeight }}>
          <DashboardPanelLayer
            panels={controller.canvasPanels}
            canvasWidth={controller.canvasWidth}
            isDragging={isDragging}
            isResizing={isResizing}
            isAnimating={isAnimating}
            canDrag={canDrag}
            canResize={canResize}
            getWidget={getWidget}
            onDragStart={controller.handleDragStart}
            onDrag={controller.handleDrag}
            onDragEnd={controller.handleDragEnd}
            onResizeStart={controller.handleResizeStart}
            onResize={controller.handleResize}
            onResizeEnd={controller.handleResizeEnd}
            onResetToDefault={controller.handleResetToDefault}
            onMinimizeToggle={controller.handleMinimizeToggle}
            onMaximizeToggle={controller.handleMaximizeToggle}
          />
        </div>
      </ReactLenis>

      {controller.dockPanels.length > 0 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
          <div className="relative w-full" style={{ height: controller.dockHeight }}>
            <DashboardPanelLayer
              panels={controller.dockPanels}
              canvasWidth={controller.canvasWidth}
              isDragging={() => false}
              isResizing={() => false}
              isAnimating={isAnimating}
              canDrag={() => false}
              canResize={() => false}
              getWidget={getWidget}
              onDragStart={controller.handleDragStart}
              onDrag={controller.handleDrag}
              onDragEnd={controller.handleDragEnd}
              onResizeStart={controller.handleResizeStart}
              onResize={controller.handleResize}
              onResizeEnd={controller.handleResizeEnd}
              onResetToDefault={controller.handleResetToDefault}
              onMinimizeToggle={controller.handleMinimizeToggle}
              onMaximizeToggle={controller.handleMaximizeToggle}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default DashboardGrid
