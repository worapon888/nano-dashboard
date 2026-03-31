import {
  CANVAS_BOTTOM_PADDING,
  GRID_MARGIN,
  MINIMIZED_PANEL_MAX_WIDTH,
  MINIMIZED_PANEL_WIDTH,
  PANEL_MAXIMIZED_MIN_HEIGHT,
  PANEL_MINIMIZED_HEIGHT,
  clamp,
  type PanelRect,
} from './dashboardLayout.shared'

function getMinimizedPanelWidth(panel: PanelRect) {
  return clamp(panel.restoreRect?.width ?? panel.width, MINIMIZED_PANEL_WIDTH, MINIMIZED_PANEL_MAX_WIDTH)
}

export function applyMinimizedDockLayout(panels: PanelRect[], canvasWidth: number) {
  if (canvasWidth <= 0) return panels

  const nextPanels = panels.map((panel) => ({ ...panel }))
  const minimizedPanels = nextPanels.filter((panel) => panel.windowState === 'minimized')
  let cursorX = 0
  let cursorY = 0

  for (const panel of minimizedPanels) {
    const dockWidth = Math.min(getMinimizedPanelWidth(panel), canvasWidth)

    if (cursorX > 0 && cursorX + dockWidth > canvasWidth) {
      cursorX = 0
      cursorY += PANEL_MINIMIZED_HEIGHT + GRID_MARGIN
    }

    panel.x = cursorX
    panel.y = cursorY
    panel.width = dockWidth
    panel.height = PANEL_MINIMIZED_HEIGHT
    cursorX += dockWidth + GRID_MARGIN
  }

  return nextPanels
}

export function autoArrangeDashboardPanels(
  panels: PanelRect[],
  canvasWidth: number,
) {
  if (canvasWidth <= 0) {
    return panels
  }

  const nextPanels = panels.map((panel) => ({
    ...panel,
    restoreRect: panel.restoreRect ? { ...panel.restoreRect } : null,
  }))
  const normalPanels = nextPanels
    .filter((panel) => panel.windowState === 'normal')
    .sort((left, right) => (left.y === right.y ? left.x - right.x : left.y - right.y))
  const minimizedPanels = nextPanels.filter((panel) => panel.windowState === 'minimized')
  const maximizedPanels = nextPanels.filter((panel) => panel.windowState === 'maximized')
  let cursorX = 0
  let cursorY = 0
  let rowHeight = 0

  for (const panel of normalPanels) {
    const nextWidth = clamp(panel.width, panel.minWidth, Math.max(canvasWidth, panel.minWidth))
    const nextHeight = Math.max(panel.height, panel.minHeight)

    if (cursorX > 0 && cursorX + nextWidth > canvasWidth) {
      cursorX = 0
      cursorY += rowHeight + GRID_MARGIN
      rowHeight = 0
    }

    panel.x = cursorX
    panel.y = cursorY
    panel.width = nextWidth
    panel.height = nextHeight

    cursorX += nextWidth + GRID_MARGIN
    rowHeight = Math.max(rowHeight, nextHeight)
  }

  const arrangedPanels = applyMinimizedDockLayout(nextPanels, canvasWidth)

  if (maximizedPanels.length > 0) {
    const maximizeHeight = Math.max(
      PANEL_MAXIMIZED_MIN_HEIGHT,
      ...arrangedPanels
        .filter((panel) => panel.windowState !== 'maximized')
        .map((panel) => panel.y + panel.height + CANVAS_BOTTOM_PADDING),
      PANEL_MAXIMIZED_MIN_HEIGHT,
    )

    for (const panel of arrangedPanels) {
      if (panel.windowState !== 'maximized') {
        continue
      }

      panel.x = 0
      panel.y = 0
      panel.width = canvasWidth
      panel.height = maximizeHeight
    }
  }

  if (minimizedPanels.length === 0) {
    return arrangedPanels
  }

  return arrangedPanels
}
