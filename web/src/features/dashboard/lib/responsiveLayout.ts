import {
  MOBILE_BREAKPOINT,
  PANEL_MINIMIZED_HEIGHT,
  RESPONSIVE_BASE_LAYOUT_WIDTH,
  TABLET_BREAKPOINT,
  clamp,
  type DashboardViewportMode,
  type PanelRect,
} from './dashboardLayout.shared'

function getResponsiveGap(mode: Exclude<DashboardViewportMode, 'desktop'>) {
  return mode === 'mobile' ? 16 : 20
}

function getResponsiveColumns(mode: Exclude<DashboardViewportMode, 'desktop'>) {
  return mode === 'mobile' ? 1 : 2
}

function getResponsivePanelSpan(
  panel: PanelRect,
  canvasWidth: number,
  mode: Exclude<DashboardViewportMode, 'desktop'>,
) {
  const columns = getResponsiveColumns(mode)

  if (columns === 1) {
    return 1
  }

  const widthRatio = panel.width / Math.max(canvasWidth, 1)
  return widthRatio >= 0.58 ? 2 : 1
}

function getResponsivePanelHeight(
  panel: PanelRect,
  targetWidth: number,
  mode: Exclude<DashboardViewportMode, 'desktop'>,
) {
  if (panel.windowState === 'minimized') {
    return PANEL_MINIMIZED_HEIGHT
  }

  const scale = targetWidth / Math.max(panel.width, 1)
  const scaledHeight = Math.round(panel.height * scale)
  const minimumHeight = mode === 'mobile' ? 220 : 240
  const maximumHeight = mode === 'mobile' ? 560 : 640
  return clamp(scaledHeight, minimumHeight, maximumHeight)
}

export function getDashboardViewportMode(containerWidth: number): DashboardViewportMode {
  if (containerWidth < MOBILE_BREAKPOINT) {
    return 'mobile'
  }

  if (containerWidth < TABLET_BREAKPOINT) {
    return 'tablet'
  }

  return 'desktop'
}

export function getLayoutSourceWidth(containerWidth: number) {
  return Math.max(containerWidth, RESPONSIVE_BASE_LAYOUT_WIDTH)
}

export function createResponsivePanels(
  panels: PanelRect[],
  canvasWidth: number,
  mode: Exclude<DashboardViewportMode, 'desktop'>,
) {
  if (canvasWidth <= 0) {
    return panels
  }

  const gap = getResponsiveGap(mode)
  const columns = getResponsiveColumns(mode)
  const columnWidth = Math.max((canvasWidth - gap * (columns - 1)) / columns, 0)
  const orderedPanels = panels
    .map((panel) => ({ ...panel, restoreRect: panel.restoreRect ? { ...panel.restoreRect } : null }))
    .sort((left, right) => (left.y === right.y ? left.x - right.x : left.y - right.y))

  const normalPanels = orderedPanels.filter((panel) => panel.windowState === 'normal')
  const minimizedPanels = orderedPanels.filter((panel) => panel.windowState === 'minimized')
  const maximizedPanels = orderedPanels.filter((panel) => panel.windowState === 'maximized')

  if (maximizedPanels.length > 0) {
    return maximizedPanels.map((panel) => ({
      ...panel,
      x: 0,
      y: 0,
      width: canvasWidth,
      height: Math.max(panel.height, mode === 'mobile' ? 480 : 560),
    }))
  }

  const nextPanels: PanelRect[] = []
  const columnHeights = Array.from({ length: columns }, () => 0)

  for (const panel of normalPanels) {
    const span = Math.min(getResponsivePanelSpan(panel, canvasWidth, mode), columns)
    const width = span === columns ? canvasWidth : columnWidth * span + gap * (span - 1)
    const height = getResponsivePanelHeight(panel, width, mode)

    if (span === columns) {
      const y = Math.max(...columnHeights)
      nextPanels.push({
        ...panel,
        x: 0,
        y,
        width,
        height,
      })
      const nextHeight = y + height + gap
      columnHeights.fill(nextHeight)
      continue
    }

    const targetColumn = columnHeights.indexOf(Math.min(...columnHeights))
    const x = targetColumn * (columnWidth + gap)
    const y = columnHeights[targetColumn]
    nextPanels.push({
      ...panel,
      x,
      y,
      width,
      height,
    })
    columnHeights[targetColumn] = y + height + gap
  }

  let dockY = nextPanels.length > 0 ? Math.max(...nextPanels.map((panel) => panel.y + panel.height)) + gap : 0

  for (const panel of minimizedPanels) {
    nextPanels.push({
      ...panel,
      x: 0,
      y: dockY,
      width: canvasWidth,
      height: PANEL_MINIMIZED_HEIGHT,
    })
    dockY += PANEL_MINIMIZED_HEIGHT + gap
  }

  return nextPanels
}
