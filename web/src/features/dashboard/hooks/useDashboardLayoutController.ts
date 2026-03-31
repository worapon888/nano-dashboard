import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ResizeDirection } from '../../../shared/types/resize'
import {
  CANVAS_BOTTOM_PADDING,
  PANEL_MIN_HEIGHT,
  absorbRowGapAfterResize,
  autoArrangeDashboardPanels,
  clamp,
  clearStoredDashboardLayout,
  createDefaultDashboardPanels,
  createResponsivePanels,
  createInitialPanels,
  getDashboardViewportMode,
  getDashboardLayoutStorageKey,
  getLayoutSourceWidth,
  parseStoredLayout,
  resolveCollisions,
  resolveInitialLayout,
  resolveResizePanels,
  serializePanelsToLayout,
  type DashboardDefinition,
  type PanelRect,
  type PanelSnapshot,
} from '../lib/dashboardLayout'
import {
  normalizePanelsToCanvas,
  resetPanelToDefault,
  togglePanelMaximized,
  togglePanelMinimized,
} from '../lib/dashboardPanelState'

type UseDashboardLayoutControllerOptions = {
  definition: DashboardDefinition
  canvasWidth: number
  resetRequestId: number
  autoArrangeRequestId: number
}

export function useDashboardLayoutController({
  definition,
  canvasWidth,
  resetRequestId,
  autoArrangeRequestId,
}: UseDashboardLayoutControllerOptions) {
  const viewportMode = useMemo(() => getDashboardViewportMode(canvasWidth), [canvasWidth])
  const isDesktopViewport = viewportMode === 'desktop'
  const widgetRegistry = definition.widgetRegistry
  const storageKey = useMemo(() => getDashboardLayoutStorageKey(definition.id), [definition.id])
  const defaultLayout = useMemo(
    () => resolveInitialLayout(widgetRegistry, definition.layout, null),
    [definition.layout, widgetRegistry],
  )
  const widgetsById = useMemo(() => new Map(Object.entries(widgetRegistry)), [widgetRegistry])
  const dragSnapshotRef = useRef<PanelSnapshot | null>(null)
  const resizeSnapshotRef = useRef<PanelSnapshot | null>(null)
  const animationTimeoutRef = useRef<number | null>(null)
  const [panels, setPanels] = useState<PanelRect[]>([])
  const [activeDragPanelId, setActiveDragPanelId] = useState<string | null>(null)
  const [activeResizePanelId, setActiveResizePanelId] = useState<string | null>(null)
  const [animatedPanelIds, setAnimatedPanelIds] = useState<string[]>([])

  const maximizedPanelId =
    panels.find((panel) => panel.windowState === 'maximized')?.id ?? null

  const visiblePanels = useMemo(() => {
    const sourcePanels = panels.filter((panel) => !maximizedPanelId || panel.id === maximizedPanelId)

    if (!isDesktopViewport) {
      return createResponsivePanels(sourcePanels, canvasWidth, viewportMode)
    }

    return sourcePanels
  }, [canvasWidth, isDesktopViewport, maximizedPanelId, panels, viewportMode])

  const canvasPanels = useMemo(
    () =>
      isDesktopViewport
        ? visiblePanels.filter((panel) => panel.windowState !== 'minimized')
        : visiblePanels,
    [isDesktopViewport, visiblePanels],
  )

  const dockPanels = useMemo(
    () =>
      isDesktopViewport
        ? visiblePanels.filter((panel) => panel.windowState === 'minimized')
        : [],
    [isDesktopViewport, visiblePanels],
  )

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

    const layoutSourceWidth = getLayoutSourceWidth(canvasWidth)
    let storedLayout = null

    try {
      storedLayout = parseStoredLayout(window.localStorage.getItem(storageKey))
    } catch {
      storedLayout = null
    }

    const initialLayout = resolveInitialLayout(widgetRegistry, definition.layout, storedLayout)
    setPanels(createInitialPanels(layoutSourceWidth, initialLayout))
  }, [canvasWidth, definition.layout, panels.length, storageKey, widgetRegistry])

  useEffect(() => {
    if (resetRequestId === 0 || canvasWidth <= 0) {
      return
    }

    clearStoredDashboardLayout(storageKey)
    dragSnapshotRef.current = null
    resizeSnapshotRef.current = null
    setActiveDragPanelId(null)
    setActiveResizePanelId(null)
    setAnimatedPanelIds([])
    setPanels(createDefaultDashboardPanels(canvasWidth, widgetRegistry, definition.layout))
  }, [canvasWidth, definition.layout, resetRequestId, storageKey, widgetRegistry])

  useEffect(() => {
    if (autoArrangeRequestId === 0 || canvasWidth <= 0) {
      return
    }

    const layoutWidth = getLayoutSourceWidth(canvasWidth)
    setPanels((currentPanels) => autoArrangeDashboardPanels(currentPanels, layoutWidth))
  }, [autoArrangeRequestId, canvasWidth])

  useEffect(() => {
    if (canvasWidth <= 0 || panels.length === 0 || !isDesktopViewport) {
      return
    }

    setPanels((currentPanels) => normalizePanelsToCanvas(currentPanels, canvasWidth))
  }, [canvasWidth, isDesktopViewport, panels.length])

  useEffect(() => {
    if (
      canvasWidth <= 0 ||
      panels.length === 0 ||
      !isDesktopViewport ||
      activeDragPanelId !== null ||
      activeResizePanelId !== null
    ) {
      return
    }

    const serializedLayout = serializePanelsToLayout(panels, canvasWidth)

    if (!serializedLayout) {
      return
    }

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(serializedLayout))
    } catch {
      // Ignore storage failures and keep the in-memory layout usable.
    }
  }, [activeDragPanelId, activeResizePanelId, canvasWidth, isDesktopViewport, panels, storageKey])

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

      if (!dragSnapshot || canvasWidth <= 0 || !isDesktopViewport) {
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
    [canvasWidth, isDesktopViewport],
  )

  const handleDragEnd = useCallback(() => {
    dragSnapshotRef.current = null
    setActiveDragPanelId(null)
  }, [])

  const handleResizeStart = useCallback(
    (panelId: string, _direction: ResizeDirection) => {
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
    (panelId: string, direction: ResizeDirection, deltaX: number, deltaY: number) => {
      const resizeSnapshot =
        resizeSnapshotRef.current?.id === panelId ? resizeSnapshotRef.current : null

      if (!resizeSnapshot || canvasWidth <= 0 || !isDesktopViewport) {
        return
      }

      const startRight = resizeSnapshot.x + resizeSnapshot.width
      const startBottom = resizeSnapshot.y + resizeSnapshot.height
      const resizeFromLeft =
        direction === 'left' || direction === 'topLeft' || direction === 'bottomLeft'
      const resizeFromTop =
        direction === 'top' || direction === 'topLeft' || direction === 'topRight'
      const resizeFromRight =
        direction === 'right' || direction === 'topRight' || direction === 'bottomRight'
      const resizeFromBottom =
        direction === 'bottom' || direction === 'bottomLeft' || direction === 'bottomRight'

      setPanels((currentPanels) =>
        resolveResizePanels(
          currentPanels.map((panel) => {
            if (panel.id !== panelId) {
              return panel
            }

            let nextX = resizeSnapshot.x
            let nextY = resizeSnapshot.y
            let nextWidth = resizeSnapshot.width
            let nextHeight = resizeSnapshot.height

            if (resizeFromLeft) {
              const maxX = startRight - resizeSnapshot.minWidth
              nextX = clamp(Math.round(resizeSnapshot.x + deltaX), 0, maxX)
              nextWidth = startRight - nextX
            } else if (resizeFromRight) {
              const maxWidth = Math.max(canvasWidth - resizeSnapshot.x, resizeSnapshot.minWidth)
              nextWidth = clamp(
                Math.round(resizeSnapshot.width + deltaX),
                resizeSnapshot.minWidth,
                maxWidth,
              )
            }

            if (resizeFromTop) {
              const maxY = startBottom - resizeSnapshot.minHeight
              nextY = clamp(Math.round(resizeSnapshot.y + deltaY), 0, maxY)
              nextHeight = startBottom - nextY
            } else if (resizeFromBottom) {
              nextHeight = Math.max(
                Math.round(resizeSnapshot.height + deltaY),
                resizeSnapshot.minHeight,
              )
            }

            if (
              nextX === panel.x &&
              nextY === panel.y &&
              nextWidth === panel.width &&
              nextHeight === panel.height
            ) {
              return panel
            }

            return {
              ...panel,
              x: nextX,
              y: nextY,
              width: nextWidth,
              height: nextHeight,
            }
          }),
          panelId,
          canvasWidth,
          direction,
        ),
      )
    },
    [canvasWidth, isDesktopViewport],
  )

  const handleResizeEnd = useCallback(() => {
    const resizeSnapshot = resizeSnapshotRef.current
    const activePanelId = resizeSnapshot?.id ?? null
    let affectedPanelIds: string[] = []

    if (activePanelId && isDesktopViewport) {
      setPanels((currentPanels) => {
        const result = absorbRowGapAfterResize(
          currentPanels,
          activePanelId,
          canvasWidth,
          resizeSnapshot,
        )

        affectedPanelIds = result.affectedPanelIds
        return result.panels
      })
    }

    if (affectedPanelIds.length > 1) {
      animatePanels(affectedPanelIds)
    }

    resizeSnapshotRef.current = null
    setActiveResizePanelId(null)
  }, [animatePanels, canvasWidth, isDesktopViewport])

  const handleMinimizeToggle = useCallback(
    (panelId: string) => {
      animatePanels([
        panelId,
        ...panels
          .filter((panel) => panel.windowState === 'minimized')
          .map((panel) => panel.id),
      ])
      setPanels((currentPanels) =>
        togglePanelMinimized(currentPanels, panelId, getLayoutSourceWidth(canvasWidth)),
      )
    },
    [animatePanels, canvasWidth, panels],
  )

  const handleResetToDefault = useCallback(
    (panelId: string) => {
      if (canvasWidth <= 0) {
        return
      }

      animatePanels([panelId])
      setPanels((currentPanels) =>
        resetPanelToDefault(currentPanels, panelId, getLayoutSourceWidth(canvasWidth), defaultLayout),
      )
    },
    [animatePanels, canvasWidth, defaultLayout],
  )

  const handleMaximizeToggle = useCallback(
    (panelId: string) => {
      animatePanels([panelId])
      setPanels((currentPanels) =>
        togglePanelMaximized(currentPanels, panelId, getLayoutSourceWidth(canvasWidth)),
      )
    },
    [animatePanels, canvasWidth],
  )

  const canvasHeight = useMemo(() => {
    const maximizedPanel = canvasPanels.find((panel) => panel.windowState === 'maximized')

    if (maximizedPanel) {
      return maximizedPanel.height + CANVAS_BOTTOM_PADDING
    }

    if (canvasPanels.length === 0) {
      return PANEL_MIN_HEIGHT
    }

    const bottomEdge = Math.max(...canvasPanels.map((panel) => panel.y + panel.height))
    return bottomEdge + CANVAS_BOTTOM_PADDING
  }, [canvasPanels])

  const dockHeight = useMemo(() => {
    if (dockPanels.length === 0) {
      return 0
    }

    return Math.max(...dockPanels.map((panel) => panel.y + panel.height))
  }, [dockPanels])

  return {
    widgetsById,
    canvasWidth,
    isDesktopViewport,
    canvasPanels,
    dockPanels,
    canvasHeight,
    dockHeight,
    activeDragPanelId,
    activeResizePanelId,
    animatedPanelIds,
    handleDragStart,
    handleDrag,
    handleDragEnd,
    handleResizeStart,
    handleResize,
    handleResizeEnd,
    handleResetToDefault,
    handleMinimizeToggle,
    handleMaximizeToggle,
  }
}
