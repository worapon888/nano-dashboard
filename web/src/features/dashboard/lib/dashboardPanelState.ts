import {
  CANVAS_BOTTOM_PADDING,
  PANEL_MAXIMIZED_MIN_HEIGHT,
  PANEL_MINIMIZED_HEIGHT,
  applyMinimizedDockLayout,
  createPanelSnapshot,
  getDefaultPanelRect,
  type DashboardLayoutItem,
  type PanelRect,
} from './dashboardLayout'

export function normalizePanelsToCanvas(panels: PanelRect[], canvasWidth: number) {
  return applyMinimizedDockLayout(
    panels.map((panel) => {
      const nextWidth = Math.min(panel.width, canvasWidth)
      const nextX = Math.min(Math.max(panel.x, 0), Math.max(canvasWidth - nextWidth, 0))

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
  )
}

export function togglePanelMinimized(
  panels: PanelRect[],
  panelId: string,
  canvasWidth: number,
) {
  return applyMinimizedDockLayout(
    panels.map((panel) => {
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
        windowState: 'minimized' as const,
        restoreRect: createPanelSnapshot(panel),
      }
    }),
    canvasWidth,
  )
}

export function resetPanelToDefault(
  panels: PanelRect[],
  panelId: string,
  canvasWidth: number,
  seedLayout: DashboardLayoutItem[],
) {
  return applyMinimizedDockLayout(
    panels.map((panel) => {
      if (panel.id !== panelId) {
        return panel
      }

      const defaultPanel = getDefaultPanelRect(panelId, canvasWidth, seedLayout)

      if (!defaultPanel) {
        return panel
      }

      return {
        ...panel,
        x: defaultPanel.x,
        y: defaultPanel.y,
        width: defaultPanel.width,
        height: defaultPanel.height,
        windowState: 'normal' as const,
        restoreRect: null,
      }
    }),
    canvasWidth,
  )
}

export function togglePanelMaximized(
  panels: PanelRect[],
  panelId: string,
  canvasWidth: number,
) {
  const targetPanel = panels.find((panel) => panel.id === panelId)

  if (!targetPanel) {
    return panels
  }

  const maximizeHeight = Math.max(
    PANEL_MAXIMIZED_MIN_HEIGHT,
    ...panels.map((panel) => panel.y + panel.height + CANVAS_BOTTOM_PADDING),
  )

  return applyMinimizedDockLayout(
    panels.map((panel) => {
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
        windowState: 'maximized' as const,
        restoreRect: createPanelSnapshot(panel),
      }
    }),
    canvasWidth,
  )
}
