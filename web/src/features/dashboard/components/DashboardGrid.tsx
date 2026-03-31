import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import useResizeObserver from '../../../hooks/useResizeObserver'
import ChartWidget from '../../../widgets/chart/ChartWidget'
import type { ChartWidgetConfig } from '../../../types/widget'
import { chartWidgetsMock } from '../mocks/chartWidgets.mock'
import { dashboardPanelsMock } from '../mocks/dashboardPanels.mock'
import useWidgetDrag from '../hooks/useWidgetDrag'
import useWidgetResize from '../hooks/useWidgetResize'

const GRID_COLUMNS = 12
const GRID_ROW_HEIGHT = 56
const GRID_MARGIN = 16
const PANEL_MIN_WIDTH = 320
const PANEL_MIN_HEIGHT = 260
const CANVAS_BOTTOM_PADDING = 24
const PANEL_MINIMIZED_HEIGHT = 76
const PANEL_MAXIMIZED_MIN_HEIGHT = 720
const MINIMIZED_PANEL_WIDTH = 288
const MINIMIZED_PANEL_MAX_WIDTH = 380

type PanelWindowState = 'normal' | 'minimized' | 'maximized'

type PanelRect = {
  id: string
  x: number
  y: number
  width: number
  height: number
  minWidth: number
  minHeight: number
  windowState: PanelWindowState
  restoreRect: PanelSnapshot | null
}

type PanelSnapshot = {
  id: string
  x: number
  y: number
  width: number
  height: number
  minWidth: number
  minHeight: number
  windowState: PanelWindowState
}

type DashboardPanelItemProps = {
  panel: PanelRect
  widget: ChartWidgetConfig
  canvasWidth: number
  isDragging: boolean
  isResizing: boolean
  isAnimating: boolean
  canDrag: boolean
  canResize: boolean
  onDragStart: (panelId: string) => void
  onDrag: (panelId: string, deltaX: number, deltaY: number) => void
  onDragEnd: () => void
  onResizeStart: (panelId: string) => void
  onResize: (panelId: string, deltaX: number, deltaY: number) => void
  onResizeEnd: () => void
  onResetToDefault: (panelId: string) => void
  onMinimizeToggle: (panelId: string) => void
  onMaximizeToggle: (panelId: string) => void
}

type HorizontalResolution = {
  x: number
  width: number
}

type VerticalResolution = {
  y: number
  height: number
}

type CollisionMode = 'drag' | 'resize'

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function intersects(a: PanelRect, b: PanelRect) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

function getHorizontalResolution(activePanel: PanelRect, targetPanel: PanelRect) {
  const targetRight = targetPanel.x + targetPanel.width
  const activeRight = activePanel.x + activePanel.width
  const options: HorizontalResolution[] = []

  if (activePanel.x > targetPanel.x) {
    const nextWidth = activePanel.x - targetPanel.x

    if (nextWidth >= targetPanel.minWidth) {
      options.push({
        x: targetPanel.x,
        width: nextWidth,
      })
    }
  }

  if (activeRight < targetRight) {
    const nextX = activeRight
    const nextWidth = targetRight - nextX

    if (nextWidth >= targetPanel.minWidth) {
      options.push({
        x: nextX,
        width: nextWidth,
      })
    }
  }

  if (options.length === 0) {
    return null
  }

  return options.sort((left, right) => left.width - right.width)[0]
}

function getVerticalResolution(activePanel: PanelRect, targetPanel: PanelRect) {
  const targetBottom = targetPanel.y + targetPanel.height
  const activeBottom = activePanel.y + activePanel.height
  const options: VerticalResolution[] = []

  if (activePanel.y > targetPanel.y) {
    const nextHeight = activePanel.y - targetPanel.y

    if (nextHeight >= targetPanel.minHeight) {
      options.push({
        y: targetPanel.y,
        height: nextHeight,
      })
    }
  }

  if (activeBottom < targetBottom) {
    const nextY = activeBottom
    const nextHeight = targetBottom - nextY

    if (nextHeight >= targetPanel.minHeight) {
      options.push({
        y: nextY,
        height: nextHeight,
      })
    }
  }

  if (options.length === 0) {
    return null
  }

  return options.sort((top, bottom) => top.height - bottom.height)[0]
}

function resolveActiveDragCollision(
  activePanel: PanelRect,
  targetPanel: PanelRect,
  canvasWidth: number,
) {
  const options = [
    {
      distance: Math.abs(activePanel.x - (targetPanel.x - activePanel.width)),
      apply: () => {
        activePanel.x = clamp(targetPanel.x - activePanel.width, 0, Math.max(canvasWidth - activePanel.width, 0))
      },
    },
    {
      distance: Math.abs(activePanel.x - (targetPanel.x + targetPanel.width)),
      apply: () => {
        activePanel.x = clamp(targetPanel.x + targetPanel.width, 0, Math.max(canvasWidth - activePanel.width, 0))
      },
    },
    {
      distance: Math.abs(activePanel.y - (targetPanel.y - activePanel.height)),
      apply: () => {
        activePanel.y = Math.max(targetPanel.y - activePanel.height, 0)
      },
    },
    {
      distance: Math.abs(activePanel.y - (targetPanel.y + targetPanel.height)),
      apply: () => {
        activePanel.y = Math.max(targetPanel.y + targetPanel.height, 0)
      },
    },
  ]

  options.sort((left, right) => left.distance - right.distance)[0]?.apply()
}

function resolveActiveResizeCollision(activePanel: PanelRect, targetPanel: PanelRect) {
  const maxWidthBeforeTarget = targetPanel.x - activePanel.x
  const maxHeightBeforeTarget = targetPanel.y - activePanel.y

  if (maxWidthBeforeTarget >= activePanel.minWidth) {
    activePanel.width = Math.min(activePanel.width, maxWidthBeforeTarget)
  }

  if (maxHeightBeforeTarget >= activePanel.minHeight) {
    activePanel.height = Math.min(activePanel.height, maxHeightBeforeTarget)
  }
}

function resolveCollisions(
  panels: PanelRect[],
  activePanelId: string,
  canvasWidth: number,
  mode: CollisionMode,
) {
  const nextPanels = panels.map((panel) => ({ ...panel }))
  const activePanel = nextPanels.find((panel) => panel.id === activePanelId)
  const maxPasses = nextPanels.length * 4

  if (!activePanel) {
    return nextPanels
  }

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let resolvedAnyCollision = false

    for (const panel of nextPanels) {
      if (panel.id === activePanelId || !intersects(activePanel, panel)) {
        continue
      }

      const horizontalResolution = getHorizontalResolution(activePanel, panel)
      const verticalResolution = getVerticalResolution(activePanel, panel)

      if (horizontalResolution || verticalResolution) {
        if (
          horizontalResolution &&
          (!verticalResolution || horizontalResolution.width >= verticalResolution.height)
        ) {
          panel.x = clamp(
            horizontalResolution.x,
            0,
            Math.max(canvasWidth - horizontalResolution.width, 0),
          )
          panel.width = horizontalResolution.width
        } else if (verticalResolution) {
          panel.y = Math.max(verticalResolution.y, 0)
          panel.height = verticalResolution.height
        }

        resolvedAnyCollision = true
      }

      if (!intersects(activePanel, panel)) {
        continue
      }

      if (mode === 'drag') {
        resolveActiveDragCollision(activePanel, panel, canvasWidth)
      } else {
        resolveActiveResizeCollision(activePanel, panel)
      }

      resolvedAnyCollision = true
    }

    if (!resolvedAnyCollision) {
      break
    }
  }

  return nextPanels
}

function resolveResizePanels(
  panels: PanelRect[],
  activePanelId: string,
  canvasWidth: number,
) {
  const nextPanels = panels.map((panel) => ({ ...panel }))
  const activePanel = nextPanels.find((panel) => panel.id === activePanelId)
  const maxPasses = nextPanels.length * 4

  if (!activePanel) {
    return nextPanels
  }

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let changed = false

    for (const panel of nextPanels) {
      if (panel.id === activePanelId || !intersects(activePanel, panel)) {
        continue
      }

      const horizontalResolution = getHorizontalResolution(activePanel, panel)
      const verticalResolution = getVerticalResolution(activePanel, panel)

      if (
        horizontalResolution &&
        (!verticalResolution || horizontalResolution.width >= verticalResolution.height)
      ) {
        const nextX = clamp(
          horizontalResolution.x,
          0,
          Math.max(canvasWidth - horizontalResolution.width, 0),
        )
        const nextWidth = horizontalResolution.width

        if (nextX !== panel.x || nextWidth !== panel.width) {
          panel.x = nextX
          panel.width = nextWidth
          changed = true
        }
      } else if (verticalResolution) {
        const nextY = Math.max(verticalResolution.y, 0)
        const nextHeight = verticalResolution.height

        if (nextY !== panel.y || nextHeight !== panel.height) {
          panel.y = nextY
          panel.height = nextHeight
          changed = true
        }
      }

      if (!intersects(activePanel, panel)) {
        continue
      }

      const previousWidth = activePanel.width
      const previousHeight = activePanel.height
      resolveActiveResizeCollision(activePanel, panel)

      if (
        activePanel.width !== previousWidth ||
        activePanel.height !== previousHeight
      ) {
        changed = true
      }
    }

    if (!changed) {
      break
    }
  }

  return nextPanels
}

function getColumnWidth(containerWidth: number) {
  return (containerWidth - GRID_MARGIN * (GRID_COLUMNS - 1)) / GRID_COLUMNS
}

function createPanelSnapshot(panel: PanelRect): PanelSnapshot {
  return {
    id: panel.id,
    x: panel.x,
    y: panel.y,
    width: panel.width,
    height: panel.height,
    minWidth: panel.minWidth,
    minHeight: panel.minHeight,
    windowState: panel.windowState,
  }
}

function getMinimizedPanelWidth(panel: PanelRect) {
  const preferredWidth = panel.restoreRect?.width ?? panel.width
  return clamp(preferredWidth, MINIMIZED_PANEL_WIDTH, MINIMIZED_PANEL_MAX_WIDTH)
}

function applyMinimizedDockLayout(panels: PanelRect[], canvasWidth: number) {
  if (canvasWidth <= 0) {
    return panels
  }

  const nextPanels = panels.map((panel) => ({ ...panel }))
  const normalPanels = nextPanels.filter((panel) => panel.windowState !== 'minimized')
  const minimizedPanels = nextPanels.filter((panel) => panel.windowState === 'minimized')
  const dockTop =
    (normalPanels.length > 0
      ? Math.max(...normalPanels.map((panel) => panel.y + panel.height))
      : 0) + GRID_MARGIN

  let cursorX = 0
  let cursorY = dockTop
  let rowHeight = PANEL_MINIMIZED_HEIGHT

  for (const panel of minimizedPanels) {
    const dockWidth = Math.min(getMinimizedPanelWidth(panel), canvasWidth)

    if (cursorX > 0 && cursorX + dockWidth > canvasWidth) {
      cursorX = 0
      cursorY += rowHeight + GRID_MARGIN
    }

    panel.x = cursorX
    panel.y = cursorY
    panel.width = dockWidth
    panel.height = PANEL_MINIMIZED_HEIGHT

    cursorX += dockWidth + GRID_MARGIN
  }

  return nextPanels
}

function createInitialPanels(containerWidth: number): PanelRect[] {
  const columnWidth = getColumnWidth(containerWidth)

  return dashboardPanelsMock.map((panel) => ({
    id: panel.id,
    x: Math.round(panel.x * (columnWidth + GRID_MARGIN)),
    y: Math.round(panel.y * (GRID_ROW_HEIGHT + GRID_MARGIN)),
    width: Math.round(panel.w * columnWidth + Math.max(panel.w - 1, 0) * GRID_MARGIN),
    height:
      Math.round(panel.h * GRID_ROW_HEIGHT + Math.max(panel.h - 1, 0) * GRID_MARGIN),
    minWidth: PANEL_MIN_WIDTH,
    minHeight: PANEL_MIN_HEIGHT,
    windowState: 'normal',
    restoreRect: null,
  }))
}

function getDefaultPanelRect(panelId: string, containerWidth: number): PanelRect | null {
  const basePanel = createInitialPanels(containerWidth).find((panel) => panel.id === panelId)
  return basePanel ?? null
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
  const panelRef = useRef<HTMLDivElement | null>(null)
  const previousPanelRef = useRef(panel)
  const { isDragging: dragActive, onDragMouseDown } = useWidgetDrag({
    onDragStart: () => onDragStart(panel.id),
    onDrag: (deltaX, deltaY) => onDrag(panel.id, deltaX, deltaY),
    onDragEnd,
  })
  const { isResizing: resizeActive, onResizeHandleMouseDown } = useWidgetResize({
    onResizeStart: () => onResizeStart(panel.id),
    onResize: (deltaX, deltaY) => onResize(panel.id, deltaX, deltaY),
    onResizeEnd,
  })

  useLayoutEffect(() => {
    const element = panelRef.current

    if (!element) {
      previousPanelRef.current = panel
      return
    }

    const previousPanel = previousPanelRef.current
    const nextOpacity = panel.windowState === 'minimized' ? 0.96 : 1
    const nextScale = panel.windowState === 'minimized' ? 0.985 : 1

    gsap.killTweensOf(element)

    if (isDragging || isResizing) {
      gsap.set(element, {
        left: panel.x,
        top: panel.y,
        width: panel.width,
        height: panel.height,
        opacity: nextOpacity,
        scale: nextScale,
      })
      previousPanelRef.current = panel
      return
    }

    if (isAnimating) {
      gsap.fromTo(
        element,
        {
          left: previousPanel.x,
          top: previousPanel.y,
          width: previousPanel.width,
          height: previousPanel.height,
          opacity:
            previousPanel.windowState === 'minimized'
              ? 0.96
              : 1,
          scale: previousPanel.windowState === 'minimized' ? 0.985 : 1,
        },
        {
          duration: 0.42,
          ease: 'power3.out',
          left: panel.x,
          top: panel.y,
          width: panel.width,
          height: panel.height,
          opacity: nextOpacity,
          scale: nextScale,
          overwrite: 'auto',
        },
      )
    } else {
      gsap.set(element, {
        left: panel.x,
        top: panel.y,
        width: panel.width,
        height: panel.height,
        opacity: nextOpacity,
        scale: nextScale,
      })
    }

    previousPanelRef.current = panel
  }, [isAnimating, isDragging, isResizing, panel])

  return (
    <div
      ref={panelRef}
      className="absolute will-change-[left,top,width,height,transform,opacity]"
      style={{
        left: panel.x,
        top: panel.y,
        width: panel.width,
        height: panel.height,
        maxWidth: canvasWidth,
        opacity: panel.windowState === 'minimized' ? 0.96 : 1,
        transform: `scale(${panel.windowState === 'minimized' ? 0.985 : 1})`,
      }}
    >
      <ChartWidget
        title={widget.title}
        chartType={widget.chartType}
        series={widget.series}
        categories={widget.categories}
        isMinimized={panel.windowState === 'minimized'}
        isMaximized={panel.windowState === 'maximized'}
        isDragging={isDragging || dragActive}
        isResizing={isResizing || resizeActive}
        onDragMouseDown={canDrag ? onDragMouseDown : undefined}
        onResizeHandleMouseDown={canResize ? onResizeHandleMouseDown : undefined}
        onResetToDefault={() => onResetToDefault(panel.id)}
        onMinimizeToggle={() => onMinimizeToggle(panel.id)}
        onMaximizeToggle={() => onMaximizeToggle(panel.id)}
      />
    </div>
  )
}

function DashboardGrid() {
  const { ref: canvasRef, width: canvasWidth } = useResizeObserver<HTMLDivElement>()
  const chartWidgetsById = useMemo(
    () => new Map(chartWidgetsMock.map((widget) => [widget.id, widget] as const)),
    [],
  )
  const dragSnapshotRef = useRef<PanelSnapshot | null>(null)
  const resizeSnapshotRef = useRef<PanelSnapshot | null>(null)
  const animationTimeoutRef = useRef<number | null>(null)
  const [panels, setPanels] = useState<PanelRect[]>([])
  const [activeDragPanelId, setActiveDragPanelId] = useState<string | null>(null)
  const [activeResizePanelId, setActiveResizePanelId] = useState<string | null>(null)
  const [animatedPanelIds, setAnimatedPanelIds] = useState<string[]>([])
  const maximizedPanelId =
    panels.find((panel) => panel.windowState === 'maximized')?.id ?? null

  const animatePanels = useCallback((panelIds: string[]) => {
    setAnimatedPanelIds(panelIds)

    if (animationTimeoutRef.current !== null) {
      window.clearTimeout(animationTimeoutRef.current)
    }

    animationTimeoutRef.current = window.setTimeout(() => {
      setAnimatedPanelIds([])
      animationTimeoutRef.current = null
    }, 320)
  }, [])

  useEffect(
    () => () => {
      if (animationTimeoutRef.current !== null) {
        window.clearTimeout(animationTimeoutRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    if (canvasWidth <= 0 || panels.length > 0) {
      return
    }

    setPanels(createInitialPanels(canvasWidth))
  }, [canvasWidth, panels.length])

  useEffect(() => {
    if (canvasWidth <= 0 || panels.length === 0) {
      return
    }

    setPanels((currentPanels) =>
      applyMinimizedDockLayout(
        currentPanels.map((panel) => {
          const nextWidth = Math.min(panel.width, canvasWidth)
          const nextX = clamp(panel.x, 0, Math.max(canvasWidth - nextWidth, 0))

          if (nextWidth === panel.width && nextX === panel.x) {
            return panel
          }

          return {
            ...panel,
            width: nextWidth,
            x: nextX,
          }
        }),
        canvasWidth,
      ),
    )
  }, [canvasWidth, panels.length])

  const handleDragStart = useCallback(
    (panelId: string) => {
      const panel = panels.find((item) => item.id === panelId)

      if (!panel) {
        return
      }

      dragSnapshotRef.current = { ...panel }
      setActiveDragPanelId(panelId)
    },
    [panels],
  )

  const handleDrag = useCallback(
    (panelId: string, deltaX: number, deltaY: number) => {
      const dragSnapshot =
        dragSnapshotRef.current?.id === panelId ? dragSnapshotRef.current : null

      if (!dragSnapshot || canvasWidth <= 0) {
        return
      }

      setPanels((currentPanels) =>
        resolveCollisions(
          currentPanels.map((panel) => {
            if (panel.id !== panelId) {
              return panel
            }

            const nextX = clamp(
              Math.round(dragSnapshot.x + deltaX),
              0,
              Math.max(canvasWidth - dragSnapshot.width, 0),
            )
            const nextY = Math.max(Math.round(dragSnapshot.y + deltaY), 0)

            if (nextX === panel.x && nextY === panel.y) {
              return panel
            }

            return {
              ...panel,
              x: nextX,
              y: nextY,
            }
          }),
          panelId,
          canvasWidth,
          'drag',
        ),
      )
    },
    [canvasWidth],
  )

  const handleDragEnd = useCallback(() => {
    dragSnapshotRef.current = null
    setActiveDragPanelId(null)
  }, [])

  const handleResizeStart = useCallback(
    (panelId: string) => {
      const panel = panels.find((item) => item.id === panelId)

      if (!panel) {
        return
      }

      resizeSnapshotRef.current = { ...panel }
      setActiveResizePanelId(panelId)
    },
    [panels],
  )

  const handleResize = useCallback(
    (panelId: string, deltaX: number, deltaY: number) => {
      const resizeSnapshot =
        resizeSnapshotRef.current?.id === panelId ? resizeSnapshotRef.current : null

      if (!resizeSnapshot || canvasWidth <= 0) {
        return
      }

      setPanels((currentPanels) =>
        resolveResizePanels(
          currentPanels.map((panel) => {
            if (panel.id !== panelId) {
              return panel
            }

            const maxWidth = Math.max(canvasWidth - resizeSnapshot.x, resizeSnapshot.minWidth)
            const nextWidth = clamp(
              Math.round(resizeSnapshot.width + deltaX),
              resizeSnapshot.minWidth,
              maxWidth,
            )
            const nextHeight = Math.max(
              Math.round(resizeSnapshot.height + deltaY),
              resizeSnapshot.minHeight,
            )

            if (nextWidth === panel.width && nextHeight === panel.height) {
              return panel
            }

            return {
              ...panel,
              width: nextWidth,
              height: nextHeight,
            }
          }),
          panelId,
          canvasWidth,
        ),
      )
    },
    [canvasWidth],
  )

  const handleResizeEnd = useCallback(() => {
    resizeSnapshotRef.current = null
    setActiveResizePanelId(null)
  }, [])

  const handleMinimizeToggle = useCallback((panelId: string) => {
    animatePanels([panelId, ...panels.filter((panel) => panel.windowState === 'minimized').map((panel) => panel.id)])
    setPanels((currentPanels) =>
      applyMinimizedDockLayout(
        currentPanels.map((panel) => {
          if (panel.id !== panelId) {
            return panel
          }

          if (panel.windowState === 'minimized' && panel.restoreRect) {
            return {
              ...panel,
              ...panel.restoreRect,
              restoreRect: null,
            }
          }

          return {
            ...panel,
            height: PANEL_MINIMIZED_HEIGHT,
            windowState: 'minimized',
            restoreRect: createPanelSnapshot(panel),
          }
        }),
        canvasWidth,
      ),
    )
  }, [animatePanels, canvasWidth, panels])

  const handleResetToDefault = useCallback(
    (panelId: string) => {
      if (canvasWidth <= 0) {
        return
      }

      animatePanels([panelId])
      setPanels((currentPanels) =>
        applyMinimizedDockLayout(
          currentPanels.map((panel) => {
            if (panel.id !== panelId) {
              return panel
            }

            const defaultPanel = getDefaultPanelRect(panelId, canvasWidth)

            if (!defaultPanel) {
              return panel
            }

            return {
              ...panel,
              x: defaultPanel.x,
              y: defaultPanel.y,
              width: defaultPanel.width,
              height: defaultPanel.height,
              isCollapsed: false,
              collapsedHeight: null,
              windowState: 'normal',
              restoreRect: null,
            }
          }),
          canvasWidth,
        ),
      )
    },
    [animatePanels, canvasWidth],
  )

  const handleMaximizeToggle = useCallback(
    (panelId: string) => {
      animatePanels([panelId])
      setPanels((currentPanels) => {
        const targetPanel = currentPanels.find((panel) => panel.id === panelId)

        if (!targetPanel) {
          return currentPanels
        }

        const maximizeHeight = Math.max(
          PANEL_MAXIMIZED_MIN_HEIGHT,
          ...currentPanels.map((panel) => panel.y + panel.height + CANVAS_BOTTOM_PADDING),
        )

        return applyMinimizedDockLayout(
          currentPanels.map((panel) => {
            if (panel.id !== panelId) {
              return panel
            }

            if (panel.windowState === 'maximized' && panel.restoreRect) {
              return {
                ...panel,
                ...panel.restoreRect,
                restoreRect: null,
              }
            }

            return {
              ...panel,
              x: 0,
              y: 0,
              width: canvasWidth,
              height: maximizeHeight,
              windowState: 'maximized',
              restoreRect: createPanelSnapshot(panel),
            }
          }),
          canvasWidth,
        )
      })
    },
    [animatePanels, canvasWidth],
  )

  const canvasHeight = useMemo(() => {
    const maximizedPanel = panels.find((panel) => panel.windowState === 'maximized')

    if (maximizedPanel) {
      return maximizedPanel.height + CANVAS_BOTTOM_PADDING
    }

    if (panels.length === 0) {
      return PANEL_MIN_HEIGHT
    }

    const bottomEdge = Math.max(...panels.map((panel) => panel.y + panel.height))
    return bottomEdge + CANVAS_BOTTOM_PADDING
  }, [panels])

  return (
    <div
      ref={canvasRef}
      className="relative min-h-[720px] w-full"
      style={{ height: canvasHeight }}
    >
      {panels
        .filter((panel) => !maximizedPanelId || panel.id === maximizedPanelId)
        .map((panel) => {
        const widget = chartWidgetsById.get(panel.id)

        if (!widget) {
          return null
        }

        return (
          <DashboardPanelItem
            key={panel.id}
            panel={panel}
            widget={widget}
            canvasWidth={canvasWidth}
            isDragging={activeDragPanelId === panel.id}
            isResizing={activeResizePanelId === panel.id}
            isAnimating={animatedPanelIds.includes(panel.id)}
            canDrag={panel.windowState !== 'maximized'}
            canResize={panel.windowState === 'normal'}
            onDragStart={handleDragStart}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            onResizeStart={handleResizeStart}
            onResize={handleResize}
            onResizeEnd={handleResizeEnd}
            onResetToDefault={handleResetToDefault}
            onMinimizeToggle={handleMinimizeToggle}
            onMaximizeToggle={handleMaximizeToggle}
          />
        )
      })}
    </div>
  )
}

export default DashboardGrid
